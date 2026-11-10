/**
 * The board window. One instance per client. The GM sees the editing tools, everybody sees
 * the table, the status line and the hand of travel options.
 */
import {
  ELEMENTS, ELEMENT_KEYS, MODULE_ID, PATH, SOCKET_NAME, THREAT_DIE, THREAT_KEYS, confirmButtons, elementLabel, esc, loc,
  manaMessage, threatLabel, txt
} from "./constants.mjs";
import { BoardView } from "./board-view.mjs";
import { MANA_TEXT_MAX, PARTY_TOKENS, cellAt, cellThreat, coords, normalizeBoard, travelDie } from "./rules.mjs";
import { canRoll, rollTravelNow, usesLookfar } from "./travel.mjs";
import { guardActions } from "./errors.mjs";
import {
  deleteBoard, getActiveBoardId, getBoard, getTerrainMap, getTerrains, listBoards,
  saveBoard, saveTerrains, setActiveBoard
} from "./store.mjs";
import {
  patchCells, placeParty, request, resetTravel, setAllRevealed, setLocked, walk
} from "./engine.mjs";
import { playOption, visibleOptions } from "./options.mjs";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

export class BoardApp extends ApplicationV2 {
  constructor(options = {}) {
    super(options);
    this.boardId = options.boardId ?? null;
    this.tool = game.user.isGM ? "select" : "walk";
    this.brush = "plains";
    this.peek = true;
    this.selected = -1;
    this.handOpen = true;
    this.view = null;
    this._lastSound = 0;
  }

  static DEFAULT_OPTIONS = {
    id: "card-atlas-board",
    classes: ["card-atlas-window"],
    tag: "div",
    window: { title: "CARDATLAS.Title", icon: "fa-solid fa-map", resizable: true },
    position: { width: 1180, height: 800 },
    // Every handler reports its errors on screen (see errors.mjs).
    actions: guardActions({
      tool: BoardApp.#onTool,
      brush: BoardApp.#onBrush,
      peek: BoardApp.#onPeek,
      newBoard: BoardApp.#onNewBoard,
      configure: BoardApp.#onConfigure,
      exportBoard: BoardApp.#onExport,
      importBoard: BoardApp.#onImport,
      deleteBoard: BoardApp.#onDelete,
      show: BoardApp.#onShow,
      revealAll: BoardApp.#onRevealAll,
      hideAll: BoardApp.#onHideAll,
      travelRoll: BoardApp.#onTravelRoll,
      rollTravel: BoardApp.#onTravelRoll,
      toggleLock: BoardApp.#onToggleLock,
      resetTravel: BoardApp.#onResetTravel,
      terrains: BoardApp.#onTerrains,
      options: BoardApp.#onOptions,
      playOption: BoardApp.#onPlayOption,
      toggleHand: BoardApp.#onToggleHand,
      zoomIn: BoardApp.#onZoomIn,
      zoomOut: BoardApp.#onZoomOut,
      fit: BoardApp.#onFit,
      center: BoardApp.#onCenter,
      cellAction: BoardApp.#onCellAction
    })
  };

  /** Open (or bring forward) the window. */
  static open(boardId) {
    const existing = foundry.applications.instances.get("card-atlas-board");
    if ( existing ) {
      if ( boardId && game.user.isGM ) existing.boardId = boardId;
      existing.sync();
      existing.bringToFront();
      if ( existing.minimized ) existing.maximize();
      return existing;
    }
    const app = new BoardApp({
      boardId,
      position: {
        width: Math.min(1400, window.innerWidth - 120),
        height: Math.min(940, window.innerHeight - 80)
      }
    });
    app.render({ force: true });
    return app;
  }

  /** Called by the setting hooks on every client. */
  static refreshAll() {
    const app = foundry.applications.instances.get("card-atlas-board");
    app?.sync();
  }

  get currentId() {
    if ( !game.user.isGM ) return getActiveBoardId();
    const ids = listBoards().map(b => b.id);
    if ( this.boardId && ids.includes(this.boardId) ) return this.boardId;
    const active = getActiveBoardId();
    this.boardId = ids.includes(active) ? active : (ids[0] ?? null);
    return this.boardId;
  }

  /* -------------------------------------------- */
  /*  Rendering                                    */
  /* -------------------------------------------- */

  async _renderHTML(context, options) {
    this._asGM = game.user.isGM;
    const root = document.createElement("div");
    root.className = `ca-app ${game.user.isGM ? "is-gm" : "is-player"}`;
    root.innerHTML = `
      ${game.user.isGM ? '<header class="ca-toolbar"></header><div class="ca-palette" hidden></div>' : ""}
      <div class="ca-main">
        <section class="ca-table">
          <div class="ca-status"></div>
          <div class="ca-zoom">
            <button type="button" data-action="zoomIn" data-tooltip="${esc(loc("View.zoomIn"))}"><i class="fa-solid fa-plus"></i></button>
            <button type="button" data-action="zoomOut" data-tooltip="${esc(loc("View.zoomOut"))}"><i class="fa-solid fa-minus"></i></button>
            <button type="button" data-action="center" data-tooltip="${esc(loc("View.center"))}"><i class="fa-solid fa-location-crosshairs"></i></button>
            <button type="button" data-action="fit" data-tooltip="${esc(loc("View.fit"))}"><i class="fa-solid fa-expand"></i></button>
          </div>
          <div class="ca-empty" hidden></div>
          <div class="ca-hand-wrap"><button type="button" class="ca-hand-toggle" data-action="toggleHand"></button><div class="ca-hand"></div></div>
        </section>
        ${game.user.isGM ? '<aside class="ca-side"></aside>' : ""}
      </div>`;
    return root;
  }

  _replaceHTML(result, content, options) {
    content.replaceChildren(result);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#bindActions();
    this.view?.destroy();
    const table = this.element.querySelector(".ca-table");
    this.view = new BoardView(table, {
      t: key => txt(key),
      assets: { tokens: Object.fromEntries(PARTY_TOKENS.filter(k => k !== "custom").map(k => [k, `${PATH}/assets/tokens/${k}.svg`])) },
      elements: ELEMENTS,
      onAction: (type, data) => this.#onViewAction(type, data)
    });
    // The board viewport sits under the status line and the hand.
    table.prepend(table.querySelector(".ca-viewport"));
    this._sideFor = null;
    this._handKey = null;
    const side = this.element.querySelector(".ca-side");
    if ( side ) this.#bindSide(side);
    this.sync({ animate: false });
    this.view.focus();
  }

  /**
   * Run this window's `data-action` buttons from a capture listener on its own content.
   * The handlers are the same ones declared in DEFAULT_OPTIONS.actions; stopping the event
   * here means Foundry's frame listener never sees it, so each click runs exactly once and
   * the buttons work even if the frame's action dispatch does not reach them.
   */
  #bindActions() {
    const root = this.element.querySelector(".ca-app");
    if ( !root ) return;
    root.addEventListener("click", event => {
      if ( event.button !== 0 ) return;
      const target = event.target.closest("[data-action]");
      if ( !target || !root.contains(target) ) return;
      const handler = this.options.actions[target.dataset.action];
      if ( typeof handler !== "function" ) return;
      event.stopPropagation();
      handler.call(this, event, target);
    }, { capture: true });
  }

  _onClose(options) {
    super._onClose(options);
    this.view?.destroy();
    this.view = null;
  }

  /** Bring the whole window in line with the stored data. */
  sync({ animate = true } = {}) {
    if ( !this.view || !this.element ) return;
    // A user promoted to (or demoted from) GM while the window is open gets the other layout.
    if ( this._asGM !== game.user.isGM ) { this.render(); return; }
    const id = this.currentId;
    const board = getBoard(id);
    const terrains = getTerrainMap();
    const isGM = game.user.isGM;
    const waitingRoll = !!board?.travel.pending && board.config.rollBy !== "auto";
    const canWalk = !!board && (isGM || (!board.travel.locked && !waitingRoll && game.settings.get(MODULE_ID, "movePermission") === "all"));
    this.view.setMode({
      isGM, peek: isGM && this.peek, tool: isGM ? this.tool : "walk", brush: this.brush,
      canWalk, selected: isGM && this.tool === "select" ? this.selected : -1
    });
    this.view.setBoard(board, terrains, { animate });
    const title = this.window?.title;
    if ( title ) title.textContent = board ? `${loc("Title")}: ${board.name}` : loc("Title");
    this.#renderEmpty(board);
    this.#renderStatus(board, terrains);
    this.#renderHand(board);
    if ( isGM ) {
      this.#renderToolbar(board);
      this.#renderPalette();
      this.#renderSide(board, terrains);
    }
  }

  #renderEmpty(board) {
    const el = this.element.querySelector(".ca-empty");
    el.hidden = !!board;
    if ( board ) return;
    el.innerHTML = game.user.isGM
      ? `<p>${esc(loc("Empty.gm"))}</p><button type="button" data-action="newBoard"><i class="fa-solid fa-plus"></i> ${esc(loc("Toolbar.new"))}</button>`
      : `<p>${esc(loc("Empty.player"))}</p>`;
  }

  #renderStatus(board, terrains) {
    const el = this.element.querySelector(".ca-status");
    if ( !board ) { el.replaceChildren(); return; }
    const t = board.travel;
    const here = board.party ? cellAt(board, board.party.x, board.party.y) : null;
    const threat = t.dayThreat || (here ? cellThreat(here, terrains) : "low");
    const parts = [
      `<span class="ca-chip"><i class="fa-solid fa-sun"></i> ${esc(loc("Status.day", { day: t.day }))}</span>`,
      `<span class="ca-chip"><i class="fa-solid fa-shoe-prints"></i> ${esc(loc("Status.steps", { n: t.steps, max: board.config.movesPerDay }))}</span>`,
      `<span class="ca-chip ca-threat-${threat}"><i class="fa-solid fa-dice-d20"></i> ${esc(loc("Status.threat", { threat: threatLabel(threat), die: `d${THREAT_DIE[threat]}` }))}</span>`
    ];
    // A Travel Roll the GM keeps secret stays out of the players' status line too.
    const showLast = game.user.isGM || board.config.messageMode !== "gm";
    if ( t.last && showLast ) {
      parts.push(`<span class="ca-chip ca-out-${t.last.outcome}"><i class="fa-solid fa-route"></i> ${esc(loc("Status.last", {
        total: t.last.total, die: `d${t.last.die}`, outcome: loc(`Outcome.${t.last.outcome}`)
      }))}</span>`);
    }
    if ( t.locked ) parts.push(`<span class="ca-chip ca-locked"><i class="fa-solid fa-hand"></i> ${esc(loc("Status.locked"))}</span>`);
    if ( t.pending ) {
      const { die } = travelDie(board.config, t.pending.threat);
      if ( t.awaitLookfar ) {
        const who = game.users.get(t.awaitLookfar.userId)?.name ?? "?";
        parts.push(`<span class="ca-chip ca-pending"><i class="fa-solid fa-hourglass-half"></i> ${esc(loc("Status.lookfarWait", { name: who }))}</span>`);
      }
      if ( canRoll(board) ) {
        parts.push(`<button type="button" class="ca-chip ca-roll" data-action="rollTravel"><i class="fa-solid fa-dice-d20"></i> ${esc(loc("Status.rollNow", { day: t.pending.day, die: `d${die}` }))}${usesLookfar(board) ? ` <span class="ca-roll-tag">Lookfar</span>` : ""}</button>`);
      }
      else parts.push(`<span class="ca-chip ca-pending"><i class="fa-solid fa-hourglass-half"></i> ${esc(loc("Status.gmWillRoll", { day: t.pending.day }))}</span>`);
    }
    el.innerHTML = parts.join("");
  }

  #renderHand(board) {
    const wrap = this.element.querySelector(".ca-hand-wrap");
    const hand = wrap.querySelector(".ca-hand");
    const options = board ? visibleOptions() : [];
    wrap.hidden = !options.length;
    wrap.classList.toggle("is-closed", !this.handOpen);
    // Rebuild only when the hand changed, so a card under the mouse is not replaced mid-hover.
    const key = `${this.handOpen}|${JSON.stringify(options)}`;
    if ( key === this._handKey ) return;
    this._handKey = key;
    wrap.querySelector(".ca-hand-toggle").innerHTML = `<i class="fa-solid fa-${this.handOpen ? "chevron-down" : "hand"}"></i> ${esc(loc("Hand.title"))}`;
    const mid = (options.length - 1) / 2;
    hand.innerHTML = options.map((o, k) => {
      const off = k - mid;
      const fan = `--ca-rot:${(off * 4).toFixed(1)}deg;--ca-drop:${(Math.abs(off) * 4 + 8).toFixed(1)}px`;
      const art = o.img ? `<img src="${esc(o.img)}" alt="">` : `<i class="${esc(o.icon || "fa-solid fa-star")}"></i>`;
      const cost = txt(o.cost);
      const desc = txt(o.description);
      const tip = `<strong>${esc(txt(o.name))}</strong>${desc ? `<br>${esc(desc).replace(/\n/g, "<br>")}` : ""}${o.source ? `<br><em>${esc(txt(o.source))}</em>` : ""}`;
      return `<button type="button" class="ca-hcard${o.gmOnly ? " is-gm-only" : ""}" data-action="playOption" data-option-id="${esc(o.id)}"
        style="${fan}" data-tooltip-html="${esc(tip)}" data-tooltip-direction="UP">
        ${cost ? `<span class="ca-hcard__cost">${esc(cost)}</span>` : ""}
        <span class="ca-hcard__art">${art}</span>
        <span class="ca-hcard__name">${esc(txt(o.name))}</span>
      </button>`;
    }).join("");
  }

  #renderToolbar(board) {
    const el = this.element.querySelector(".ca-toolbar");
    if ( !el ) return;
    const boards = listBoards();
    const active = getActiveBoardId();
    const id = board?.id ?? "";
    const btn = (action, icon, label, { on = false, extra = "", cls = "" } = {}) =>
      `<button type="button" class="${cls}${on ? " is-on" : ""}" data-action="${action}" ${extra} data-tooltip="${esc(label)}" aria-label="${esc(label)}"><i class="${icon}"></i></button>`;
    const tools = [
      ["walk", "fa-solid fa-person-hiking"], ["select", "fa-solid fa-arrow-pointer"],
      ["paint", "fa-solid fa-paintbrush"], ["reveal", "fa-solid fa-eye"], ["party", "fa-solid fa-flag"]
    ];
    const t = board?.travel;
    el.innerHTML = `
      <div class="ca-group">
        <select class="ca-board-select" aria-label="${esc(loc("Toolbar.board"))}">
          ${boards.map(b => `<option value="${esc(b.id)}" ${b.id === id ? "selected" : ""}>${b.id === active ? "★ " : ""}${esc(b.name)}</option>`).join("")}
        </select>
        ${btn("newBoard", "fa-solid fa-plus", loc("Toolbar.new"))}
        ${board ? btn("configure", "fa-solid fa-gear", loc("Toolbar.configure")) : ""}
        ${board ? btn("exportBoard", "fa-solid fa-file-export", loc("Toolbar.export")) : ""}
        ${btn("importBoard", "fa-solid fa-file-import", loc("Toolbar.import"))}
        ${board ? btn("deleteBoard", "fa-solid fa-trash", loc("Toolbar.delete")) : ""}
      </div>
      ${board ? `
      <div class="ca-group">
        <button type="button" class="ca-show${id === active ? " is-on" : ""}" data-action="show"><i class="fa-solid fa-tower-broadcast"></i> ${esc(loc(id === active ? "Toolbar.shown" : "Toolbar.show"))}</button>
      </div>
      <div class="ca-group ca-tools">
        ${tools.map(([k, icon]) => btn("tool", icon, loc(`Tool.${k}`), { on: this.tool === k, extra: `data-tool="${k}"` })).join("")}
        ${btn("peek", this.peek ? "fa-solid fa-eye" : "fa-solid fa-eye-low-vision", loc(this.peek ? "Toolbar.peekOn" : "Toolbar.peekOff"), { on: this.peek })}
      </div>
      <div class="ca-group">
        ${btn("revealAll", "fa-solid fa-clone", loc("Toolbar.revealAll"))}
        ${btn("hideAll", "fa-regular fa-clone", loc("Toolbar.hideAll"))}
      </div>
      <div class="ca-group">
        ${btn("travelRoll", "fa-solid fa-dice-d20", loc("Toolbar.travelRoll"), { cls: t?.pending ? "is-pulse" : "" })}
        ${btn("toggleLock", t?.locked ? "fa-solid fa-lock" : "fa-solid fa-lock-open", loc(t?.locked ? "Toolbar.unlock" : "Toolbar.lock"), { on: !!t?.locked })}
        ${btn("resetTravel", "fa-solid fa-rotate-left", loc("Toolbar.resetTravel"))}
      </div>` : ""}
      <div class="ca-group ca-right">
        ${btn("terrains", "fa-solid fa-mountain-sun", loc("Toolbar.terrains"))}
        ${btn("options", "fa-solid fa-hand", loc("Toolbar.options"))}
      </div>`;
    el.querySelector(".ca-board-select")?.addEventListener("change", ev => {
      this.boardId = ev.currentTarget.value;
      this.selected = -1;
      this.sync({ animate: false });
    });
  }

  #renderPalette() {
    const el = this.element.querySelector(".ca-palette");
    if ( !el ) return;
    el.hidden = this.tool !== "paint";
    if ( el.hidden ) return;
    const chips = getTerrains().map(t => `
      <button type="button" class="ca-chip-terrain${this.brush === t.id ? " is-on" : ""}" data-action="brush" data-brush="${esc(t.id)}" data-tooltip="${esc(txt(t.name))}">
        <span class="ca-swatch" style="background-image:url('${esc(t.img)}');--ca-terrain:${esc(t.color || "#777")}"></span>
        <span>${esc(txt(t.name))}</span>
      </button>`).join("");
    // Latent mana brushes paint an element over the cards without changing their terrain.
    const mana = ELEMENT_KEYS.map(k => `
      <button type="button" class="ca-chip-terrain ca-chip-mana${this.brush === `mana:${k}` ? " is-on" : ""}" data-action="brush" data-brush="mana:${k}" style="--ca-mana:${ELEMENTS[k].color}" data-tooltip="${esc(loc("Mana.brush", { element: elementLabel(k) }))}">
        <span class="ca-swatch ca-swatch-mana"><i class="${ELEMENTS[k].icon}"></i></span>
        <span>${esc(elementLabel(k))}</span>
      </button>`).join("");
    el.innerHTML = `<div class="ca-palette-row">${chips}<button type="button" class="ca-chip-terrain is-eraser${this.brush === "__empty" ? " is-on" : ""}" data-action="brush" data-brush="__empty">
      <span class="ca-swatch"><i class="fa-solid fa-eraser"></i></span><span>${esc(loc("Tool.noCard"))}</span></button></div>
      <div class="ca-palette-row ca-palette-mana"><span class="ca-palette-label"><i class="fa-solid fa-wand-sparkles"></i> ${esc(loc("Mana.title"))}</span>${mana}
      <button type="button" class="ca-chip-terrain is-eraser${this.brush === "mana:none" ? " is-on" : ""}" data-action="brush" data-brush="mana:none">
        <span class="ca-swatch"><i class="fa-solid fa-ban"></i></span><span>${esc(loc("Mana.remove"))}</span></button></div>`;
  }

  /** GM side panel: edit the selected card. */
  #renderSide(board, terrains) {
    const el = this.element.querySelector(".ca-side");
    if ( !el ) return;
    const show = !!board && this.tool === "select" && this.selected >= 0 && this.selected < board.cells.length;
    el.hidden = !show;
    this.element.querySelector(".ca-main").classList.toggle("has-side", show);
    if ( !show ) { el.replaceChildren(); this._sideFor = null; return; }
    const i = this.selected;
    const cell = board.cells[i];
    // Same card still selected: refresh the values in place (keeps focus while the GM types).
    const key = `${board.id}:${i}:${cell ? "card" : "empty"}`;
    if ( key === this._sideFor ) return this.#fillSide(el, cell, terrains, board);
    this._sideFor = key;
    const { x, y } = coords(board, i);
    if ( !cell ) {
      el.innerHTML = `<h3>${esc(loc("Cell.title", { x: x + 1, y: y + 1 }))}</h3><p class="ca-muted">${esc(loc("Cell.empty"))}</p>
        <button type="button" data-action="cellAction" data-op="create"><i class="fa-solid fa-plus"></i> ${esc(loc("Cell.create"))}</button>`;
      return;
    }
    const opt = (v, l) => `<option value="${esc(v)}">${esc(l)}</option>`;
    el.innerHTML = `
      <h3>${esc(loc("Cell.title", { x: x + 1, y: y + 1 }))}</h3>
      <div class="ca-field"><label>${esc(loc("Cell.terrain"))}</label>
        <select name="terrain">${getTerrains().map(t => opt(t.id, txt(t.name))).join("")}</select></div>
      <div class="ca-field ca-check"><label><input type="checkbox" name="revealed"> ${esc(loc("Cell.revealed"))}</label></div>
      <div class="ca-field"><label>${esc(loc("Cell.label"))}</label><input type="text" name="label"></div>
      <div class="ca-field ca-img"><label>${esc(loc("Cell.img"))}</label></div>
      <div class="ca-field"><label>${esc(loc("Cell.threat"))}</label>
        <select name="threat">${opt("", "")}${THREAT_KEYS.map(k => opt(k, `${threatLabel(k)} (d${THREAT_DIE[k]})`)).join("")}</select></div>
      <div class="ca-field"><label>${esc(loc("Cell.passable"))}</label>
        <select name="passable">${opt("", "")}${opt("true", loc("Common.yes"))}${opt("false", loc("Common.no"))}</select></div>
      <div class="ca-field"><label>${esc(loc("Mana.title"))}</label>
        <select name="mana">${opt("", loc("Mana.none"))}${ELEMENT_KEYS.map(k => opt(k, elementLabel(k))).join("")}</select></div>
      <div class="ca-field ca-check" data-mana-only><label><input type="checkbox" name="manaHidden"> ${esc(loc("Mana.hidden"))}</label></div>
      <div class="ca-field" data-mana-only><label>${esc(loc("Mana.message"))}</label>
        <textarea name="manaText" rows="3" maxlength="${MANA_TEXT_MAX}"></textarea>
        <p class="ca-muted ca-mana-hint"></p></div>
      <div class="ca-field"><label>${esc(loc("Cell.text"))}</label><textarea name="text" rows="4" placeholder="${esc(loc("Cell.textHint"))}"></textarea></div>
      <div class="ca-field"><label>${esc(loc("Cell.link"))}</label><input type="text" name="link" placeholder="${esc(loc("Cell.linkHint"))}"></div>
      <div class="ca-field"><label>${esc(loc("Cell.note"))}</label><textarea name="note" rows="3"></textarea></div>
      <div class="ca-side-buttons">
        <button type="button" data-action="cellAction" data-op="party"><i class="fa-solid fa-flag"></i> ${esc(loc("Cell.placeParty"))}</button>
        <button type="button" data-action="cellAction" data-op="ping"><i class="fa-solid fa-bullseye"></i> ${esc(loc("Cell.ping"))}</button>
        <button type="button" data-action="cellAction" data-op="remove"><i class="fa-solid fa-trash"></i> ${esc(loc("Cell.remove"))}</button>
      </div>`;
    const picker = foundry.applications.elements.HTMLFilePickerElement.create({ name: "img", value: cell.img ?? "", type: "image" });
    el.querySelector(".ca-img").append(picker);
    this.#fillSide(el, cell, terrains, board);
  }

  /** Write the card's values into the panel, skipping the field that has focus. */
  #fillSide(el, cell, terrains, board) {
    if ( !cell ) return;
    const terr = terrains.get(cell.terrain);
    const active = el.ownerDocument.activeElement;
    const set = (name, value) => {
      const input = el.querySelector(`[name="${name}"]`);
      if ( !input || input === active || input.contains?.(active) ) return;
      if ( input.type === "checkbox" ) input.checked = !!value;
      else if ( input.value !== value ) input.value = value;
    };
    set("terrain", cell.terrain);
    set("revealed", !!cell.revealed);
    set("label", cell.label ?? "");
    set("img", cell.img ?? "");
    set("threat", cell.threat ?? "");
    set("passable", typeof cell.passable === "boolean" ? String(cell.passable) : "");
    set("mana", cell.mana ?? "");
    set("manaHidden", !!cell.manaHidden);
    set("manaText", cell.manaText ?? "");
    for ( const field of el.querySelectorAll("[data-mana-only]") ) field.hidden = !cell.mana;
    const manaBox = el.querySelector('textarea[name="manaText"]');
    if ( manaBox && cell.mana ) {
      // The placeholder previews what the chat says when this card has no message of its own.
      const place = cell.label || txt(terr?.name) || cell.terrain;
      manaBox.placeholder = manaMessage(board?.config, { ...cell, manaText: "" }, place);
      const chatOn = board?.config?.manaChat !== false;
      el.querySelector(".ca-mana-hint").textContent = loc(chatOn ? "Mana.messageHint" : "Mana.chatOff");
    }
    set("text", txt(cell.text ?? ""));
    set("link", cell.link ?? "");
    set("note", cell.note ?? "");
    const label = el.querySelector('input[name="label"]');
    if ( label ) label.placeholder = terr?.banner ? txt(terr.name) : "";
    const threatDefault = el.querySelector('select[name="threat"] option[value=""]');
    if ( threatDefault ) threatDefault.textContent = loc("Cell.default", { value: threatLabel(terr?.threat) });
    const passDefault = el.querySelector('select[name="passable"] option[value=""]');
    if ( passDefault ) passDefault.textContent = loc("Cell.default", { value: loc(terr?.passable === false ? "Common.no" : "Common.yes") });
  }

  /** Side panel listeners, bound once per render (the panel element survives every sync). */
  #bindSide(side) {
    const save = data => {
      const id = this.currentId;
      if ( id && this.selected >= 0 ) patchCells(id, [{ i: this.selected, data }]);
    };
    side.addEventListener("change", ev => {
      const input = ev.target;
      const name = input.getAttribute?.("name");
      if ( !name ) return;
      let value = input.type === "checkbox" ? input.checked : input.value;
      if ( name === "passable" ) value = value === "" ? null : value === "true";
      save({ [name]: value });
    });
    side.addEventListener("dragover", ev => {
      if ( ev.target.closest?.('input[name="link"]') ) ev.preventDefault();
    });
    side.addEventListener("drop", ev => {
      const link = ev.target.closest?.('input[name="link"]');
      if ( !link ) return;
      ev.preventDefault();
      const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
      if ( !data?.uuid ) return;
      link.value = data.uuid;
      save({ link: data.uuid });
    });
  }

  /* -------------------------------------------- */
  /*  View events                                  */
  /* -------------------------------------------- */

  async #onViewAction(type, data) {
    const id = this.currentId;
    if ( !id && type !== "flipped" ) return;
    switch ( type ) {
      case "walk":
        if ( game.user.isGM ) {
          const res = await walk(id, data.x, data.y, { gm: true });
          if ( !res?.ok && res?.reason ) ui.notifications.warn(loc(`Reason.${res.reason}`));
        }
        else await request("walk", { boardId: id, x: data.x, y: data.y });
        break;
      case "select":
        this.selected = data.i;
        this.sync({ animate: false });
        break;
      case "place": await placeParty(id, data.x, data.y); break;
      case "paint": {
        if ( String(data.terrain).startsWith("mana:") ) {
          // Mana goes on existing cards only; "mana:none" removes it.
          const element = data.terrain.slice(5);
          const cells = getBoard(id)?.cells ?? [];
          const patches = data.indices.filter(i => cells[i]).map(i => ({ i, data: { mana: element === "none" ? "" : element } }));
          if ( patches.length ) await patchCells(id, patches);
          break;
        }
        await patchCells(id, data.indices.map(i => ({ i, data: data.terrain === "__empty" ? null : { terrain: data.terrain, img: "" } })));
        break;
      }
      case "reveal":
        await patchCells(id, data.indices.map(i => ({ i, data: { revealed: !!data.revealed } })));
        break;
      case "ping": this.#ping(data.i, true); break;
      case "openLink": await this.#openLink(data.i); break;
      case "flipped": this.#playFlip(); break;
    }
  }

  #ping(i, broadcast) {
    const color = game.user.color?.css ?? String(game.user.color ?? "#ffd76a");
    this.view?.ping(i, color);
    if ( broadcast ) game.socket?.emit(SOCKET_NAME, { type: "ping", boardId: this.currentId, i, color });
  }

  /** Socket: someone else pinged a card. */
  receivePing({ boardId, i, color }) {
    if ( boardId === this.currentId ) this.view?.ping(i, color);
  }

  async #openLink(i) {
    const board = getBoard(this.currentId);
    const uuid = board?.cells[i]?.link;
    if ( !uuid ) return;
    const doc = await foundry.utils.fromUuid(uuid);
    if ( !doc ) return ui.notifications.warn(loc("Notify.badLink"));
    if ( doc.documentName === "JournalEntryPage" ) return doc.parent?.sheet?.render({ force: true, pageId: doc.id });
    if ( doc.documentName === "Scene" ) return game.user.isGM ? doc.view() : null;
    return doc.sheet?.render({ force: true });
  }

  #playFlip() {
    const src = game.settings.get(MODULE_ID, "flipSound");
    const volume = Number(game.settings.get(MODULE_ID, "volume")) || 0;
    const now = Date.now();
    if ( !src || volume <= 0 || (now - this._lastSound) < 250 ) return;
    this._lastSound = now;
    foundry.audio.AudioHelper.play({ src, volume, autoplay: true, loop: false }, false);
  }

  /* -------------------------------------------- */
  /*  Actions                                      */
  /* -------------------------------------------- */

  /** @this {BoardApp} */
  static #onTool(event, target) {
    this.tool = target.dataset.tool;
    if ( this.tool !== "select" ) this.selected = -1;
    this.sync({ animate: false });
  }

  /** @this {BoardApp} */
  static #onBrush(event, target) {
    this.brush = target.dataset.brush;
    this.sync({ animate: false });
  }

  /** @this {BoardApp} */
  static #onPeek() {
    this.peek = !this.peek;
    this.sync({ animate: false });
  }

  /** @this {BoardApp} */
  static async #onNewBoard() {
    const { NewBoardApp } = await import("./new-board.mjs");
    await NewBoardApp.open();
  }

  /** @this {BoardApp} */
  static async #onConfigure() {
    const { BoardConfigApp } = await import("./editors.mjs");
    if ( this.currentId ) new BoardConfigApp({ boardId: this.currentId }).render({ force: true });
  }

  /** @this {BoardApp} */
  static #onExport() {
    const board = getBoard(this.currentId);
    if ( !board ) return;
    const used = new Set(board.cells.filter(Boolean).map(c => c.terrain));
    const data = { type: "card-atlas-board", version: 1, board, terrains: getTerrains().filter(t => used.has(t.id)) };
    // Decompose accents, keep only ASCII (drops the combining marks), then slugify.
    const ascii = [...board.name.toLowerCase().normalize("NFD")].filter(ch => ch.charCodeAt(0) < 128).join("");
    const slug = ascii.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "board";
    foundry.utils.saveDataToFile(JSON.stringify(data, null, 2), "application/json", `card-atlas-${slug}.json`);
  }

  /** @this {BoardApp} */
  static #onImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if ( !file ) return;
      try {
        const json = JSON.parse(await foundry.utils.readTextFromFile(file));
        const raw = json?.type === "card-atlas-board" ? json.board : json;
        const board = normalizeBoard(raw);
        if ( !board || !board.cells.length ) throw new Error("invalid board");
        board.id = foundry.utils.randomID();
        if ( Array.isArray(json?.terrains) ) {
          const lib = getTerrains();
          const known = new Set(lib.map(t => t.id));
          const extra = json.terrains.filter(t => t?.id && !known.has(t.id));
          if ( extra.length ) await saveTerrains([...lib, ...extra]);
        }
        await saveBoard(board);
        this.boardId = board.id;
        this.sync({ animate: false });
        ui.notifications.info(loc("Notify.imported", { name: board.name }));
      } catch(err) {
        console.error(`${MODULE_ID} |`, err);
        ui.notifications.error(loc("Notify.importFailed"));
      }
    });
    input.click();
  }

  /** @this {BoardApp} */
  static async #onDelete() {
    const board = getBoard(this.currentId);
    if ( !board ) return;
    const ok = await DialogV2.confirm({
      window: { title: loc("Toolbar.delete"), icon: "fa-solid fa-trash" },
      content: `<p>${esc(loc("Confirm.delete", { name: board.name }))}</p>`,
      ...confirmButtons(), rejectClose: false
    });
    if ( !ok ) return;
    await deleteBoard(board.id);
    this.boardId = null;
    this.selected = -1;
    this.sync({ animate: false });
  }

  /** @this {BoardApp} */
  static async #onShow() {
    const id = this.currentId;
    if ( !id ) return;
    await setActiveBoard(id);
    game.socket?.emit(SOCKET_NAME, { type: "show", boardId: id });
    ui.notifications.info(loc("Notify.shown"));
  }

  /** @this {BoardApp} */
  static async #onRevealAll() { if ( this.currentId ) await setAllRevealed(this.currentId, true); }

  /** @this {BoardApp} */
  static async #onHideAll() {
    if ( !this.currentId ) return;
    const ok = await DialogV2.confirm({
      window: { title: loc("Toolbar.hideAll") }, content: `<p>${esc(loc("Confirm.hideAll"))}</p>`, ...confirmButtons(), rejectClose: false
    });
    if ( ok ) await setAllRevealed(this.currentId, false);
  }

  /** @this {BoardApp} */
  static async #onTravelRoll() { if ( this.currentId ) await rollTravelNow(this.currentId); }

  /** @this {BoardApp} */
  static async #onToggleLock() {
    const board = getBoard(this.currentId);
    if ( board ) await setLocked(board.id, !board.travel.locked);
  }

  /** @this {BoardApp} */
  static async #onResetTravel() {
    if ( !this.currentId ) return;
    const ok = await DialogV2.confirm({
      window: { title: loc("Toolbar.resetTravel") }, content: `<p>${esc(loc("Confirm.resetTravel"))}</p>`, ...confirmButtons(), rejectClose: false
    });
    if ( ok ) await resetTravel(this.currentId);
  }

  /** @this {BoardApp} */
  static async #onTerrains() {
    const { TerrainLibraryApp } = await import("./editors.mjs");
    new TerrainLibraryApp().render({ force: true });
  }

  /** @this {BoardApp} */
  static async #onOptions() {
    const { OptionsEditorApp } = await import("./editors.mjs");
    new OptionsEditorApp().render({ force: true });
  }

  /** @this {BoardApp} */
  static async #onPlayOption(event, target) {
    const id = this.currentId;
    if ( id ) await playOption(id, target.dataset.optionId);
  }

  /** @this {BoardApp} */
  static #onToggleHand() {
    this.handOpen = !this.handOpen;
    this.#renderHand(getBoard(this.currentId));
  }

  /** @this {BoardApp} */
  static #onZoomIn() { this.view?.zoomBy(1.2); }

  /** @this {BoardApp} */
  static #onZoomOut() { this.view?.zoomBy(1 / 1.2); }

  /** @this {BoardApp} */
  static #onFit() {
    const handOpen = this.handOpen && !this.element.querySelector(".ca-hand-wrap")?.hidden;
    this.view?.fit({ top: 50, bottom: handOpen ? 150 : 40 });
  }

  /** @this {BoardApp} */
  static #onCenter() {
    const board = getBoard(this.currentId);
    if ( board?.party ) this.view?.centerOn(board.party, true);
  }

  /** @this {BoardApp} */
  static async #onCellAction(event, target) {
    const id = this.currentId;
    const i = this.selected;
    const board = getBoard(id);
    if ( !board || i < 0 ) return;
    const { x, y } = coords(board, i);
    switch ( target.dataset.op ) {
      case "create": await patchCells(id, [{ i, data: { terrain: this.brush === "__empty" ? "plains" : this.brush } }]); break;
      case "remove": await patchCells(id, [{ i, data: null }]); break;
      case "party": await placeParty(id, x, y); break;
      case "ping": this.#ping(i, true); break;
    }
  }
}
