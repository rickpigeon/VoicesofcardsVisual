/**
 * DOM view of one board: cards, flips, the group's token, pan and zoom, pointer tools.
 * It has no Foundry dependency. The Foundry window (board-app.mjs) and the local preview
 * harness drive it with setBoard()/setMode() and listen through `onAction(type, data)`.
 *
 * Actions emitted: walk {x,y} · select {i} · place {x,y} · paint {indices, terrain}
 *                  reveal {indices, revealed} · ping {i} · openLink {i} · flipped {count}
 */
import { coords, isPassable, neighbors } from "./rules.mjs";

const CARD_W = 100;
const CARD_H = 140;
const GAP = 12;
const PAD = 60;
const FLIP_MS = 720;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.2;
// Fixed, scattered positions (in % of the card) for the 7 latent-mana particles.
const MANA_X = [16, 68, 40, 84, 28, 56, 8];
const MANA_Y = [70, 28, 54, 78, 16, 62, 40];

export class BoardView {
  constructor(root, { t = k => k, onAction = () => {}, assets = {}, elements = {} } = {}) {
    this.root = root;
    this.t = t;
    this.onAction = onAction;
    this.assets = assets;
    this.elements = elements;
    this.doc = root.ownerDocument;
    this.board = null;
    this.terrains = new Map();
    this.mode = { isGM: false, peek: true, tool: "walk", brush: "plains", canWalk: true, selected: -1 };
    this.pan = { x: 0, y: 0 };
    this.zoom = 1;
    this.cellEls = [];
    this.shown = [];
    this.revealed = [];
    this.lastParty = null;
    this.#buildShell();
  }

  /* -------------------------------------------- */
  /*  Shell                                        */
  /* -------------------------------------------- */

  #buildShell() {
    const d = this.doc;
    this.viewport = d.createElement("div");
    this.viewport.className = "ca-viewport";
    this.viewport.tabIndex = 0;
    // Foundry's KeyboardManager#hasFocus treats this element as focused, so core keybindings
    // (pan the canvas, move tokens, pause) stay quiet while the table has focus.
    this.viewport.dataset.keyboardFocus = "true";
    this.stage = d.createElement("div");
    this.stage.className = "ca-stage";
    this.boardEl = d.createElement("div");
    this.boardEl.className = "ca-board";
    this.pawn = d.createElement("div");
    this.pawn.className = "ca-pawn";
    this.pawn.innerHTML = '<div class="ca-pawn__shadow"></div><div class="ca-pawn__token"><div class="ca-pawn__img"></div></div><div class="ca-pawn__label" hidden></div>';
    this.stage.append(this.boardEl);
    this.viewport.append(this.stage);
    this.root.append(this.viewport);

    this._onPointerDown = this.#onPointerDown.bind(this);
    this._onPointerMove = this.#onPointerMove.bind(this);
    this._onPointerUp = this.#onPointerUp.bind(this);
    this._onWheel = this.#onWheel.bind(this);
    this._onKey = this.#onKeyDown.bind(this);
    this._onClick = this.#onClick.bind(this);
    this.viewport.addEventListener("pointerdown", this._onPointerDown);
    this.viewport.addEventListener("pointermove", this._onPointerMove);
    this.viewport.addEventListener("pointerup", this._onPointerUp);
    this.viewport.addEventListener("pointercancel", this._onPointerUp);
    this.viewport.addEventListener("wheel", this._onWheel, { passive: false });
    this.viewport.addEventListener("keydown", this._onKey);
    this.viewport.addEventListener("click", this._onClick);
    this.viewport.addEventListener("contextmenu", ev => ev.preventDefault());
  }

  destroy() {
    this.viewport.removeEventListener("wheel", this._onWheel);
    this.viewport.remove();
  }

  /* -------------------------------------------- */
  /*  Public API                                   */
  /* -------------------------------------------- */

  /** Show a board. Rebuilds when the board or its size changes, otherwise patches the cards. */
  setBoard(board, terrains, { animate = true } = {}) {
    const rebuild = !this.board || (board?.id !== this.board.id) || (board?.cols !== this.board.cols) || (board?.rows !== this.board.rows);
    this.board = board;
    this.terrains = terrains ?? new Map();
    if ( !board ) {
      this.boardEl.replaceChildren();
      this.cellEls = [];
      return;
    }
    this.boardEl.style.setProperty("--ca-tilt", `${Number(board.config.tilt) || 0}deg`);
    this.root.style.setProperty("--ca-back", board.config.backImg ? `url("${board.config.backImg}")` : "");
    if ( rebuild ) this.#build();
    else this.#patch(animate);
    this.#updatePawn(rebuild ? false : animate);
    this.#updateTargets();
    if ( rebuild ) this.#whenSized(() => this.centerOn(board.party, false));
  }

  setMode(patch) {
    Object.assign(this.mode, patch);
    const r = this.root.classList;
    for ( const c of [...r] ) if ( c.startsWith("tool-") ) r.remove(c);
    r.add(`tool-${this.mode.tool}`);
    r.toggle("is-gm", !!this.mode.isGM);
    if ( this.board ) {
      this.#patch(false);
      this.#updateTargets();
    }
  }

  /** Smoothly move the camera so the cell (x, y) sits in the middle of the viewport. */
  centerOn(pos, smooth = true) {
    if ( !pos || !this.board ) return;
    const el = this.cellEls[(pos.y * this.board.cols) + pos.x];
    if ( !el ) return;
    const vp = this.viewport.getBoundingClientRect();
    if ( !vp.width ) return;
    const st = this.stage.getBoundingClientRect();
    const c = el.getBoundingClientRect();
    const offX = (c.left + (c.width / 2)) - st.left;
    const offY = (c.top + (c.height / 2)) - st.top;
    this.#setPan((vp.width / 2) - offX, (vp.height / 2) - offY, smooth);
  }

  /**
   * Zoom so the whole (tilted) board fits the free area of the viewport.
   * Insets keep it clear of overlays such as the status line and the hand.
   */
  fit({ top = 50, bottom = 40, side = 30 } = {}) {
    if ( !this.board ) return;
    const vp = this.viewport.getBoundingClientRect();
    const old = { pan: { ...this.pan }, zoom: this.zoom };
    this.stage.classList.remove("is-gliding");
    // Measure the projected board at zoom 1, then at the chosen zoom.
    this.zoom = 1;
    this.#setPan(0, 0, false);
    let r = this.boardEl.getBoundingClientRect();
    const availW = Math.max(100, vp.width - (side * 2));
    const availH = Math.max(100, vp.height - top - bottom);
    this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(availW / r.width, availH / r.height)));
    this.#setPan(0, 0, false);
    r = this.boardEl.getBoundingClientRect();
    const target = {
      x: (vp.left + (vp.width / 2)) - (r.left + (r.width / 2)),
      y: (vp.top + top + (availH / 2)) - (r.top + (r.height / 2))
    };
    // Jump back to where we were, then glide to the target.
    const zoom = this.zoom;
    this.zoom = old.zoom;
    this.#setPan(old.pan.x, old.pan.y, false);
    void this.stage.offsetWidth;
    this.zoom = zoom;
    this.#setPan(target.x, target.y, true);
  }

  zoomBy(factor) {
    const vp = this.viewport.getBoundingClientRect();
    this.#zoomAt(vp.width / 2, vp.height / 2, factor);
  }

  ping(i, color = "#ffd76a") {
    const el = this.cellEls[i];
    if ( !el ) return;
    const p = this.doc.createElement("div");
    p.className = "ca-ping";
    p.style.setProperty("--ca-ping", color);
    el.append(p);
    setTimeout(() => p.remove(), 1600);
  }

  focus() {
    this.viewport.focus({ preventScroll: true });
  }

  /* -------------------------------------------- */
  /*  Build & patch                                */
  /* -------------------------------------------- */

  #build() {
    const b = this.board;
    const d = this.doc;
    this.root.classList.add("no-anim");
    this.boardEl.replaceChildren();
    this.boardEl.style.setProperty("--ca-cols", b.cols);
    this.boardEl.style.setProperty("--ca-rows", b.rows);
    this.stage.style.width = `${(b.cols * (CARD_W + GAP)) + (PAD * 2)}px`;
    this.stage.style.height = `${(b.rows * (CARD_H + GAP)) + (PAD * 2)}px`;
    this.cellEls = [];
    this.shown = [];
    this.revealed = [];
    const frag = d.createDocumentFragment();
    for ( let i = 0; i < b.cells.length; i++ ) {
      const { x, y } = coords(b, i);
      const el = d.createElement("div");
      el.className = "ca-cell";
      el.dataset.i = String(i);
      el.style.gridColumn = String(x + 1);
      el.style.gridRow = String(y + 1);
      el.innerHTML = '<div class="ca-card"><div class="ca-card__inner">'
        + '<div class="ca-face ca-face--back"></div>'
        + '<div class="ca-face ca-face--front"><div class="ca-face__art"></div><div class="ca-banner"></div></div>'
        + '</div></div><div class="ca-marks"></div><div class="ca-trail"></div>';
      this.cellEls.push(el);
      this.shown.push(false);
      frag.append(el);
    }
    frag.append(this.pawn);
    this.boardEl.append(frag);
    this.#patch(false);
    requestAnimationFrame(() => requestAnimationFrame(() => this.root.classList.remove("no-anim")));
  }

  /** Bring every card in line with the data; animate cards that just turned face up. */
  #patch(animate) {
    const b = this.board;
    const party = b.party;
    let flipped = 0;
    for ( let i = 0; i < this.cellEls.length; i++ ) {
      const el = this.cellEls[i];
      const cell = b.cells[i];
      const showFront = !!cell && (cell.revealed || (this.mode.isGM && this.mode.peek));
      const wasShown = this.shown[i];
      // The GM (seeing hidden cards) gets the lift and the sound when the group reveals one.
      const unveiled = !!cell?.revealed && !this.revealed[i] && wasShown;
      this.#applyCell(el, i, cell, showFront);
      this.revealed[i] = !!cell?.revealed;
      if ( ((showFront && !wasShown) || unveiled) && animate ) {
        const { x, y } = coords(b, i);
        const dist = party ? Math.abs(party.x - x) + Math.abs(party.y - y) : 0;
        el.style.setProperty("--ca-delay", `${Math.min(6, dist) * 90}ms`);
        el.classList.remove("is-flipping");
        void el.offsetWidth; // restart the lift animation
        el.classList.add("is-flipping");
        setTimeout(() => el.classList.remove("is-flipping"), FLIP_MS + 700);
        flipped++;
      }
      else if ( !animate ) el.style.removeProperty("--ca-delay");
      this.shown[i] = showFront;
    }
    if ( flipped ) this.onAction("flipped", { count: flipped });
  }

  #applyCell(el, i, cell, showFront) {
    const cl = el.classList;
    cl.toggle("is-empty", !cell);
    cl.toggle("show-front", showFront);
    cl.toggle("is-revealed", !!cell?.revealed);
    cl.toggle("is-veiled", !!cell && !cell.revealed && showFront);
    cl.toggle("is-visited", !!cell?.visited && (cell.revealed || this.mode.isGM));
    cl.toggle("is-selected", this.mode.selected === i);
    const party = this.board.party;
    const { x, y } = coords(this.board, i);
    cl.toggle("is-party", !!party && party.x === x && party.y === y);
    const art = el.querySelector(".ca-face__art");
    const banner = el.querySelector(".ca-banner");
    const marks = el.querySelector(".ca-marks");
    if ( !cell || !showFront ) {
      // Players never get the face of a hidden card in their DOM (nor its latent mana).
      if ( art.dataset.src ) { art.style.backgroundImage = ""; art.dataset.src = ""; }
      banner.textContent = "";
      banner.hidden = true;
      el.removeAttribute("data-tooltip-text");
      cl.remove("is-blocked");
      marks.replaceChildren();
      this.#applyMana(el, null);
      if ( cell && this.mode.isGM ) this.#gmMarks(marks, cell, i);
      return;
    }
    const terrain = this.terrains.get(cell.terrain);
    const src = cell.img || terrain?.img || "";
    if ( art.dataset.src !== src ) {
      art.style.backgroundImage = src ? `url("${src}")` : "";
      art.dataset.src = src;
    }
    el.style.setProperty("--ca-terrain", terrain?.color || "#777");
    const name = this.t(terrain?.name ?? cell.terrain);
    const label = cell.label || (terrain?.banner ? name : "");
    banner.textContent = label;
    banner.hidden = !label;
    cl.toggle("is-blocked", !isPassable(cell, this.terrains));
    const threat = cell.threat || terrain?.threat || "low";
    const manaShown = this.elements[cell.mana] && (this.mode.isGM || !cell.manaHidden) ? cell.mana : null;
    this.#applyMana(el, manaShown, !!cell.manaHidden);
    const manaTip = manaShown ? ` · ${this.t("CARDATLAS.Mana.title")}: ${this.t(`CARDATLAS.Element.${manaShown}`)}` : "";
    const tip = `${label && label !== name ? `${label} · ` : ""}${name} · ${this.t(`CARDATLAS.Threat.${threat}`)}${manaTip}`;
    el.setAttribute("data-tooltip-text", tip);
    marks.replaceChildren();
    if ( this.mode.isGM ) this.#gmMarks(marks, cell, i);
    else if ( cell.link && cell.revealed ) {
      const btn = this.doc.createElement("button");
      btn.type = "button";
      btn.className = "ca-mark ca-mark--link";
      btn.dataset.caLink = String(i);
      btn.innerHTML = '<i class="fa-solid fa-book-open"></i>';
      marks.append(btn);
    }
  }

  /**
   * Latent mana: an animated aura and particles in the element's colour over the card.
   * The overlay only exists while the card's face is shown, and is removed otherwise.
   */
  #applyMana(el, element, gmOnly = false) {
    let fx = el.querySelector(":scope > .ca-mana");
    if ( !element ) {
      fx?.remove();
      el.classList.remove("has-mana");
      return;
    }
    const info = this.elements[element];
    if ( !fx ) {
      fx = this.doc.createElement("div");
      fx.className = "ca-mana";
      let html = '<span class="ca-mana__aura"></span><span class="ca-mana__veil"></span>';
      for ( let k = 0; k < 7; k++ ) {
        html += `<span class="ca-mana__p" style="--i:${k};--x:${MANA_X[k]}%;--y:${MANA_Y[k]}%"></span>`;
      }
      html += '<span class="ca-mana__icon"><i></i></span>';
      fx.innerHTML = html;
      el.querySelector(".ca-card").after(fx);
    }
    if ( fx.dataset.element !== element ) {
      fx.dataset.element = element;
      fx.className = `ca-mana ca-mana--${element}`;
      fx.style.setProperty("--ca-mana", info.color);
      fx.querySelector(".ca-mana__icon i").className = info.icon;
    }
    fx.classList.toggle("is-gm-only", gmOnly && this.mode.isGM);
    el.classList.add("has-mana");
  }

  #gmMarks(marks, cell, i) {
    const add = (cls, icon, link) => {
      const m = this.doc.createElement(link ? "button" : "span");
      m.className = `ca-mark ${cls}`;
      if ( link ) { m.type = "button"; m.dataset.caLink = link; }
      m.innerHTML = `<i class="${icon}"></i>`;
      marks.append(m);
    };
    if ( !cell.revealed ) add("ca-mark--hidden", "fa-solid fa-eye-slash");
    if ( cell.note ) add("ca-mark--note", "fa-solid fa-note-sticky");
    if ( cell.text ) add("ca-mark--text", "fa-solid fa-scroll");
    if ( cell.link ) add("ca-mark--link", "fa-solid fa-book-open", String(i));
  }

  #updatePawn(animate) {
    const p = this.board.party;
    this.pawn.hidden = !p;
    if ( !p ) return;
    this.#styleToken(this.board.config);
    const moved = this.lastParty && (this.lastParty.x !== p.x || this.lastParty.y !== p.y);
    this.pawn.style.transform = `translate(${PAD + (p.x * (CARD_W + GAP))}px, ${PAD + (p.y * (CARD_H + GAP))}px)`;
    if ( moved && animate ) {
      this.pawn.classList.remove("is-hopping");
      void this.pawn.offsetWidth;
      this.pawn.classList.add("is-hopping");
      if ( this.board.config.follow !== false ) setTimeout(() => this.centerOn(p, true), 60);
    }
    this.lastParty = { x: p.x, y: p.y };
  }

  /** The group's token: built-in art or a custom image, ring or no frame, colour, size, label. */
  #styleToken(c) {
    const tokens = this.assets.tokens ?? {};
    const custom = c.partyToken === "custom" && c.partyImg;
    const img = custom ? c.partyImg : (tokens[c.partyToken] ?? tokens.party ?? "");
    const imgEl = this.pawn.querySelector(".ca-pawn__img");
    const css = img ? `url("${img}")` : "";
    if ( imgEl.style.backgroundImage !== css ) imgEl.style.backgroundImage = css;
    this.pawn.classList.toggle("is-frameless", c.partyFrame === "none");
    this.pawn.style.setProperty("--ca-pawn-scale", String((Number(c.partyScale) || 100) / 100));
    this.pawn.style.setProperty("--ca-pawn-ring", c.partyColor || "#d8b25e");
    const label = this.pawn.querySelector(".ca-pawn__label");
    const text = String(c.partyLabel ?? "").trim();
    label.textContent = text;
    label.hidden = !text;
  }

  #updateTargets() {
    for ( const el of this.boardEl.querySelectorAll(".is-target") ) el.classList.remove("is-target");
    const b = this.board;
    if ( !b?.party || this.mode.tool !== "walk" || !this.mode.canWalk ) return;
    for ( const n of neighbors(b, b.party.x, b.party.y) ) {
      const cell = b.cells[n.i];
      if ( cell.revealed && !isPassable(cell, this.terrains) ) continue;
      this.cellEls[n.i]?.classList.add("is-target");
    }
  }

  /* -------------------------------------------- */
  /*  Camera                                       */
  /* -------------------------------------------- */

  #setPan(x, y, smooth) {
    this.pan = { x, y };
    if ( smooth ) {
      this.stage.classList.add("is-gliding");
      clearTimeout(this._glide);
      this._glide = setTimeout(() => this.stage.classList.remove("is-gliding"), 650);
    }
    this.stage.style.transform = `translate(${x}px, ${y}px) scale(${this.zoom})`;
  }

  #zoomAt(px, py, factor) {
    const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom * factor));
    const k = z / this.zoom;
    this.zoom = z;
    this.#setPan(px - ((px - this.pan.x) * k), py - ((py - this.pan.y) * k), false);
  }

  #whenSized(fn) {
    let tries = 0;
    const tick = () => {
      if ( this.viewport.getBoundingClientRect().width > 0 ) return fn();
      if ( ++tries < 60 ) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* -------------------------------------------- */
  /*  Pointer & keyboard                           */
  /* -------------------------------------------- */

  #cellFromPoint(x, y) {
    const el = this.doc.elementFromPoint(x, y)?.closest?.(".ca-cell");
    return (el && this.boardEl.contains(el)) ? el : null;
  }

  #onPointerDown(ev) {
    if ( ev.target.closest("[data-ca-link]") ) return;
    this.viewport.focus({ preventScroll: true });
    const cellEl = ev.target.closest(".ca-cell");
    const painting = this.mode.isGM && ["paint", "reveal"].includes(this.mode.tool) && ev.button === 0 && cellEl;
    this.drag = {
      id: ev.pointerId,
      x0: ev.clientX, y0: ev.clientY,
      pan0: { ...this.pan },
      kind: painting ? "stroke" : (ev.button === 0 ? "maybe" : "pan"),
      cellEl,
      shift: ev.shiftKey,
      touched: new Set(),
      revealTo: null
    };
    if ( painting ) this.#strokeAt(cellEl);
    try { this.viewport.setPointerCapture(ev.pointerId); } catch(err) { /* synthetic or finished pointer */ }
  }

  #onPointerMove(ev) {
    const d = this.drag;
    if ( !d || d.id !== ev.pointerId ) return;
    if ( d.kind === "stroke" ) {
      const el = this.#cellFromPoint(ev.clientX, ev.clientY);
      if ( el ) this.#strokeAt(el);
      return;
    }
    const dx = ev.clientX - d.x0;
    const dy = ev.clientY - d.y0;
    if ( d.kind === "maybe" && Math.hypot(dx, dy) > 6 ) d.kind = "pan";
    if ( d.kind === "pan" ) {
      this.viewport.classList.add("is-panning");
      this.#setPan(d.pan0.x + dx, d.pan0.y + dy, false);
    }
  }

  #onPointerUp(ev) {
    const d = this.drag;
    if ( !d || d.id !== ev.pointerId ) return;
    this.drag = null;
    this.viewport.classList.remove("is-panning");
    try { this.viewport.releasePointerCapture(ev.pointerId); } catch(err) { /* already released */ }
    if ( ev.type === "pointercancel" ) return;
    if ( d.kind === "stroke" ) {
      const indices = [...d.touched];
      if ( !indices.length ) return;
      if ( this.mode.tool === "paint" ) this.onAction("paint", { indices, terrain: this.mode.brush });
      else this.onAction("reveal", { indices, revealed: d.revealTo });
      return;
    }
    if ( d.kind !== "maybe" || !d.cellEl ) return;
    const i = Number(d.cellEl.dataset.i);
    const { x, y } = coords(this.board, i);
    if ( d.shift ) return this.onAction("ping", { i });
    switch ( this.mode.tool ) {
      case "walk": return this.onAction("walk", { x, y });
      case "select": return this.onAction("select", { i });
      case "party": return this.onAction("place", { x, y });
    }
  }

  /** Paint or reveal one cell during a drag, updating the card at once (the save follows on release). */
  #strokeAt(el) {
    const d = this.drag;
    const i = Number(el.dataset.i);
    if ( d.touched.has(i) ) return;
    const b = this.board;
    if ( this.mode.tool === "paint" ) {
      const brush = this.mode.brush;
      if ( brush.startsWith("mana:") ) {
        // Latent mana only goes on existing cards and keeps their terrain.
        if ( !b.cells[i] ) return;
        d.touched.add(i);
        const element = brush.slice(5);
        b.cells[i] = { ...b.cells[i], mana: element === "none" ? "" : element };
        this.#applyCell(el, i, b.cells[i], b.cells[i].revealed || (this.mode.isGM && this.mode.peek));
        return;
      }
      d.touched.add(i);
      b.cells[i] = brush === "__empty" ? null : { ...(b.cells[i] ?? {}), terrain: brush, img: "" };
      this.#applyCell(el, i, b.cells[i], !!b.cells[i] && (b.cells[i].revealed || (this.mode.isGM && this.mode.peek)));
      return;
    }
    const cell = b.cells[i];
    if ( !cell ) return;
    if ( d.revealTo === null ) d.revealTo = !cell.revealed;
    d.touched.add(i);
    cell.revealed = d.revealTo;
    const show = cell.revealed || this.mode.peek;
    this.#applyCell(el, i, cell, show);
    this.shown[i] = show;
    this.revealed[i] = cell.revealed;
  }

  #onClick(ev) {
    const btn = ev.target.closest("[data-ca-link]");
    if ( !btn ) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.onAction("openLink", { i: Number(btn.dataset.caLink) });
  }

  #onWheel(ev) {
    ev.preventDefault();
    const vp = this.viewport.getBoundingClientRect();
    const factor = Math.exp(-ev.deltaY * 0.0015);
    this.#zoomAt(ev.clientX - vp.left, ev.clientY - vp.top, factor);
  }

  #onKeyDown(ev) {
    const dirs = {
      ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
      ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
      KeyQ: [-1, -1], KeyE: [1, -1], KeyZ: [-1, 1], KeyC: [1, 1]
    };
    if ( ev.ctrlKey || ev.metaKey || ev.altKey ) return;
    // Keys used here must not also reach Foundry's own shortcuts (Space pauses, arrows move tokens).
    const consume = () => { ev.preventDefault(); ev.stopPropagation(); };
    if ( ev.code === "Equal" || ev.code === "NumpadAdd" ) { consume(); this.zoomBy(1.15); return; }
    if ( ev.code === "Minus" || ev.code === "NumpadSubtract" ) { consume(); this.zoomBy(1 / 1.15); return; }
    if ( ev.code === "Space" ) { consume(); this.centerOn(this.board?.party, true); return; }
    const dir = dirs[ev.code];
    if ( !dir ) return;
    consume();
    if ( !this.board?.party || this.mode.tool !== "walk" ) return;
    if ( dir[0] && dir[1] && !this.board.config.diagonal ) return;
    this.onAction("walk", { x: this.board.party.x + dir[0], y: this.board.party.y + dir[1] });
  }
}

