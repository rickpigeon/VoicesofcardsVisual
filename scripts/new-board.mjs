/**
 * "New map" window: generate a themed map, start from the sample or from a blank grid.
 * A plain ApplicationV2 (the same kind of window as the board itself) with its own listeners,
 * so it does not depend on DialogV2.
 */
import { MODULE_ID, esc, loc, txt } from "./constants.mjs";
import { createBoard, createSampleBoard } from "./defaults.mjs";
import { revealAround } from "./rules.mjs";
import { LIMITS, SIZES, THEMES, generateBoard, randomSeed, summarizeBoard } from "./generator.mjs";
import { getActiveBoardId, getTerrainMap, getTerrains, saveBoard, setActiveBoard } from "./store.mjs";
import { reportError } from "./errors.mjs";

const { ApplicationV2 } = foundry.applications.api;
const SUMMARY_ORDER = ["city", "village", "camp", "dungeon", "ruins", "treasure", "volcano"];
const BLANK_LIMITS = { min: 2, max: 80 };

export class NewBoardApp extends ApplicationV2 {
  constructor(options = {}) {
    super(options);
    this.draft = {
      kind: "generate", theme: "continent", size: "medium", cols: 16, rows: 10,
      seed: randomSeed(), name: "", fill: "plains",
      startMode: "village", start: null, startVillage: true
    };
    this._busy = false;
    this._cache = { key: "", board: null };
  }

  static DEFAULT_OPTIONS = {
    id: "card-atlas-new",
    classes: ["card-atlas-new"],
    tag: "div",
    window: { title: "CARDATLAS.New.title", icon: "fa-solid fa-map-location-dot" },
    position: { width: 800, height: "auto" }
  };

  /** Open (or bring forward) the window. Resolves after the first render, so errors surface. */
  static async open() {
    const existing = foundry.applications.instances.get("card-atlas-new");
    if ( existing ) {
      existing.bringToFront();
      return existing;
    }
    return new NewBoardApp().render({ force: true });
  }

  /* -------------------------------------------- */

  async _renderHTML() {
    const s = this.draft;
    const opt = (value, label, current) => `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(label)}</option>`;
    const kind = (k, icon) => `<button type="button" class="ca-new-kind${s.kind === k ? " is-on" : ""}" data-kind="${k}"><i class="${icon}"></i> ${esc(loc(`New.kind_${k}`))}</button>`;
    const sizes = Object.entries(SIZES).map(([k, [c, r]]) => opt(k, `${loc(`New.size_${k}`)} (${c} × ${r})`, s.size)).join("")
      + opt("custom", loc("New.size_custom"), s.size);
    const root = document.createElement("div");
    root.className = "ca-new";
    root.innerHTML = `
      <form class="ca-new-form" autocomplete="off">
        <nav class="ca-new-kinds">
          ${kind("generate", "fa-solid fa-dice")}
          ${kind("sample", "fa-solid fa-map")}
          ${kind("blank", "fa-regular fa-square")}
        </nav>
        <div class="ca-new-body">
          <div class="ca-new-fields">
            <div class="ca-new-field">
              <label for="ca-new-name">${esc(loc("New.name"))}</label>
              <input id="ca-new-name" type="text" name="name" value="${esc(s.name)}" maxlength="60">
            </div>
            <div class="ca-new-field" data-show="generate">
              <label for="ca-new-theme">${esc(loc("New.theme"))}</label>
              <select id="ca-new-theme" name="theme">${THEMES.map(t => opt(t, loc(`Theme.${t}`), s.theme)).join("")}</select>
            </div>
            <p class="ca-new-desc" data-show="generate" data-role="themeDesc"></p>
            <div class="ca-new-field" data-show="generate">
              <label for="ca-new-size">${esc(loc("New.size"))}</label>
              <select id="ca-new-size" name="size">${sizes}</select>
            </div>
            <div class="ca-new-dims" data-show="custom blank">
              <div class="ca-new-field">
                <label for="ca-new-cols">${esc(loc("New.cols"))}</label>
                <input id="ca-new-cols" type="number" name="cols" value="${s.cols}" min="${LIMITS.min}" max="${LIMITS.max}">
              </div>
              <div class="ca-new-field">
                <label for="ca-new-rows">${esc(loc("New.rows"))}</label>
                <input id="ca-new-rows" type="number" name="rows" value="${s.rows}" min="${LIMITS.min}" max="${LIMITS.max}">
              </div>
            </div>
            <div class="ca-new-field" data-show="generate">
              <label for="ca-new-seed">${esc(loc("New.seed"))}</label>
              <div class="ca-new-seed">
                <input id="ca-new-seed" type="text" name="seed" value="${esc(s.seed)}" maxlength="40">
                <button type="button" data-role="reroll"><i class="fa-solid fa-dice"></i> ${esc(loc("New.reroll"))}</button>
              </div>
            </div>
            <p class="ca-new-hint" data-show="generate">${esc(loc("New.seedHint"))}</p>
            <div class="ca-new-field" data-show="generate">
              <label for="ca-new-start">${esc(loc("New.start_title"))}</label>
              <select id="ca-new-start" name="startMode">${["village", "city", "pick"].map(k => opt(k, loc(`New.start_${k}`), s.startMode)).join("")}</select>
            </div>
            <label class="ca-new-check" data-show="pick"><input type="checkbox" name="startVillage" ${s.startVillage ? "checked" : ""}> ${esc(loc("New.startVillage"))}</label>
            <p class="ca-new-hint ca-new-start-hint" data-show="generate blank" data-role="startHint"></p>
            <div class="ca-new-field" data-show="blank">
              <label for="ca-new-fill">${esc(loc("New.fill"))}</label>
              <select id="ca-new-fill" name="fill">${getTerrains().map(t => opt(t.id, txt(t.name), s.fill)).join("")}</select>
            </div>
            <p class="ca-new-desc" data-show="sample">${esc(loc("New.sampleHint"))}</p>
            <p class="ca-new-hint" data-show="generate sample blank">${esc(loc("New.editHint"))}</p>
          </div>
          <div class="ca-new-preview">
            <canvas></canvas>
            <p class="ca-new-summary"></p>
          </div>
        </div>
        <footer class="ca-new-footer">
          <button type="submit" class="ca-new-create"><i class="fa-solid fa-check"></i> ${esc(loc("New.create"))}</button>
        </footer>
      </form>`;
    return root;
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const form = this.element.querySelector(".ca-new-form");
    form.addEventListener("submit", event => {
      event.preventDefault();
      this.#create();
    });
    form.addEventListener("input", () => this.#update());
    form.addEventListener("change", () => this.#update());
    for ( const btn of form.querySelectorAll("[data-kind]") ) {
      btn.addEventListener("click", () => {
        this.draft.kind = btn.dataset.kind;
        this.#update();
      });
    }
    form.querySelector("[data-role=reroll]").addEventListener("click", () => {
      form.elements.seed.value = randomSeed();
      this.#update();
    });
    // Clicking a card of the preview chooses where the group starts.
    const canvas = form.querySelector(".ca-new-preview canvas");
    canvas.addEventListener("click", event => {
      const g = this._grid;
      if ( !g || this.draft.kind === "sample" ) return;
      const x = Math.floor(event.offsetX / (g.size + g.gap));
      const y = Math.floor(event.offsetY / (g.size + g.gap));
      if ( x < 0 || y < 0 || x >= g.cols || y >= g.rows ) return;
      this.draft.start = { x, y };
      form.elements.namedItem("startMode").value = "pick";
      this.#update();
    });
    this.#update();
  }

  /* -------------------------------------------- */

  /** Read the form into `draft`, show the fields of the current kind and redraw the preview. */
  #update() {
    try {
      const form = this.element?.querySelector(".ca-new-form");
      if ( !form ) return;
      const s = this.draft;
      const field = n => form.elements.namedItem(n);
      const limits = s.kind === "blank" ? BLANK_LIMITS : LIMITS;
      s.name = field("name").value;
      s.theme = field("theme").value;
      s.size = field("size").value;
      s.seed = field("seed").value.trim() || "atlas";
      s.fill = field("fill").value;
      s.cols = clampSize(field("cols").value, s.cols, limits);
      s.rows = clampSize(field("rows").value, s.rows, limits);
      s.startMode = field("startMode").value;
      s.startVillage = field("startVillage").checked;
      for ( const n of ["cols", "rows"] ) {
        field(n).min = String(limits.min);
        field(n).max = String(limits.max);
      }
      if ( s.kind === "generate" && SIZES[s.size] ) {
        [s.cols, s.rows] = SIZES[s.size];
        // "Custom" then starts from the last preset.
        field("cols").value = String(s.cols);
        field("rows").value = String(s.rows);
      }
      for ( const btn of form.querySelectorAll("[data-kind]") ) btn.classList.toggle("is-on", btn.dataset.kind === s.kind);
      // A chosen start outside a resized grid is dropped.
      if ( s.start && (s.start.x >= s.cols || s.start.y >= s.rows) ) s.start = null;
      if ( s.startMode !== "pick" && s.kind === "generate" ) s.start = null;
      for ( const el of form.querySelectorAll("[data-show]") ) {
        const show = el.dataset.show.split(" ");
        const custom = show.includes("custom") && s.kind === "generate" && s.size === "custom";
        const pick = show.includes("pick") && s.kind === "generate" && s.startMode === "pick";
        el.hidden = !(show.includes(s.kind) || custom || pick);
      }
      form.querySelector("[data-role=themeDesc]").textContent = loc(`ThemeDesc.${s.theme}`);
      const hint = s.start ? loc("New.startChosen", { x: s.start.x + 1, y: s.start.y + 1 }) : "";
      form.querySelector("[data-role=startHint]").textContent = `${loc("New.startHint")}${hint ? ` ${hint}` : ""}`;
      form.querySelector(".ca-new-preview canvas").classList.toggle("is-pickable", s.kind !== "sample");
      field("name").placeholder = this.#defaultName();
      this.#drawPreview(this.#previewBoard());
    } catch ( err ) {
      reportError(err, "newBoard");
    }
  }

  #defaultName() {
    const s = this.draft;
    if ( s.kind === "generate" ) return `${loc(`Theme.${s.theme}`)} ${s.seed}`;
    if ( s.kind === "sample" ) return loc("New.kind_sample");
    return loc("New.defaultName");
  }

  /** The board the current fields would create (cached while nothing changes). */
  #previewBoard() {
    const s = this.draft;
    const at = s.start ? `${s.start.x},${s.start.y}` : "-";
    const key = s.kind === "generate" ? `g|${s.theme}|${s.cols}|${s.rows}|${s.seed}|${s.startMode}|${at}|${s.startVillage}`
      : s.kind === "blank" ? `b|${s.cols}|${s.rows}|${s.fill}|${at}` : "s";
    if ( this._cache.key !== key ) this._cache = { key, board: this.#build("preview") };
    return this._cache.board;
  }

  #build(id) {
    const s = this.draft;
    const name = s.name.trim() || this.#defaultName();
    if ( s.kind === "sample" ) return createSampleBoard({ id, name });
    if ( s.kind === "blank" ) {
      const board = createBoard({ id, name, cols: s.cols, rows: s.rows, fill: s.fill || "plains" });
      if ( s.start ) moveStart(board, s.start);
      return board;
    }
    const start = s.startMode === "pick" && s.start
      ? { mode: "pick", x: s.start.x, y: s.start.y, village: s.startVillage }
      : { mode: s.startMode === "city" ? "city" : "village" };
    return generateBoard({ id, name, theme: s.theme, cols: s.cols, rows: s.rows, seed: s.seed, start });
  }

  #drawPreview(board) {
    const canvas = this.element.querySelector(".ca-new-preview canvas");
    const box = canvas.parentElement;
    // The box has 10px of padding on each side.
    const maxW = Math.max(200, box.clientWidth - 24);
    const maxH = 280;
    const gap = 1;
    const size = Math.max(4, Math.floor(Math.min((maxW + gap) / board.cols, (maxH + gap) / board.rows)) - gap);
    const w = (board.cols * (size + gap)) - gap;
    const h = (board.rows * (size + gap)) - gap;
    this._grid = { size, gap, cols: board.cols, rows: board.rows };
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const terrains = getTerrainMap();
    const r = Math.max(1, size * 0.18);
    board.cells.forEach((cell, i) => {
      if ( !cell ) return;
      const x = (i % board.cols) * (size + gap);
      const y = Math.floor(i / board.cols) * (size + gap);
      const t = terrains.get(cell.terrain);
      ctx.fillStyle = t?.color || "#777";
      roundRect(ctx, x, y, size, size, r);
      ctx.fill();
      if ( cell.terrain === "sea" && cell.passable ) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
        ctx.fillRect(x + (size * 0.2), y + (size * 0.45), size * 0.6, Math.max(1, size * 0.1));
      }
      if ( t?.banner ) {
        ctx.fillStyle = "#f3ead6";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x + (size / 2), y + (size / 2), Math.max(2, size * 0.2), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
    const p = board.party;
    if ( p ) {
      ctx.strokeStyle = "#ffd65a";
      ctx.lineWidth = Math.max(2, size * 0.14);
      roundRect(ctx, (p.x * (size + gap)) + 1, (p.y * (size + gap)) + 1, size - 2, size - 2, r);
      ctx.stroke();
    }
    this.#writeSummary(board, terrains);
  }

  #writeSummary(board, terrains) {
    const el = this.element.querySelector(".ca-new-summary");
    const { counts, start } = summarizeBoard(board);
    const parts = SUMMARY_ORDER.filter(k => counts[k]).map(k => `${txt(terrains.get(k)?.name ?? k)} ×${counts[k]}`);
    const lines = [`${board.cols} × ${board.rows}${parts.length ? ` · ${parts.join(" · ")}` : ""}`];
    if ( start ) lines.push(loc("New.start", { name: start }));
    el.innerHTML = lines.map(l => `<span>${esc(l)}</span>`).join("");
  }

  /* -------------------------------------------- */

  async #create() {
    if ( this._busy ) return;
    this._busy = true;
    try {
      this.#update();
      const board = this.#build(foundry.utils.randomID());
      await saveBoard(board);
      if ( !getActiveBoardId() ) await setActiveBoard(board.id);
      const main = foundry.applications.instances.get("card-atlas-board");
      if ( main ) {
        main.boardId = board.id;
        main.selected = -1;
        main.sync({ animate: false });
      }
      else game.modules.get(MODULE_ID)?.api?.open(board.id);
      await this.close();
    } catch ( err ) {
      reportError(err, "newBoard");
    } finally {
      this._busy = false;
    }
  }
}

/** Blank map: put the group on the chosen card instead of the middle. */
function moveStart(board, { x, y }) {
  for ( const c of board.cells ) if ( c ) { c.revealed = false; c.visited = false; }
  board.party = { x, y };
  board.cells[(y * board.cols) + x].visited = true;
  revealAround(board, x, y, board.config.revealRadius);
}

function clampSize(value, fallback, limits) {
  const n = Math.floor(Number(value));
  if ( !Number.isFinite(n) ) return fallback;
  return Math.max(limits.min, Math.min(limits.max, n));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
