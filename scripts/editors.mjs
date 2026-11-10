/**
 * GM editors: board settings, terrain library, travel options (the players' hand).
 */
import { MODULE_ID, OPTION_ACTIONS, THREAT_DIE, THREAT_KEYS, PATH, loc, threatLabel, txt } from "./constants.mjs";
import { resizeBoard } from "./rules.mjs";
import { defaultOptions } from "./defaults.mjs";
import { getBoard, getOptions, getTerrains, mutateBoard, saveOptions, saveTerrains } from "./store.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

function readForm(form) {
  const flat = new foundry.applications.ux.FormDataExtended(form).object;
  return foundry.utils.expandObject(flat);
}

/** {"0": {...}, "1": {...}} → array in index order. */
function toArray(obj) {
  if ( Array.isArray(obj) ) return obj;
  return Object.keys(obj ?? {}).sort((a, b) => Number(a) - Number(b)).map(k => obj[k]);
}

function threatChoices() {
  return Object.fromEntries(THREAT_KEYS.map(k => [k, `${threatLabel(k)} (d${THREAT_DIE[k]})`]));
}

/** Accept a document dragged from the sidebar into a UUID text field. */
function bindUuidDrop(root, selector) {
  for ( const input of root.querySelectorAll(selector) ) {
    input.addEventListener("dragover", ev => ev.preventDefault());
    input.addEventListener("drop", ev => {
      ev.preventDefault();
      const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
      if ( data?.uuid ) input.value = data.uuid;
    });
  }
}

/* -------------------------------------------- */
/*  Board settings                               */
/* -------------------------------------------- */

export class BoardConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.boardId = options.boardId;
  }

  static DEFAULT_OPTIONS = {
    id: "card-atlas-config-{id}",
    classes: ["card-atlas-editor"],
    tag: "form",
    window: { title: "CARDATLAS.Config.title", icon: "fa-solid fa-gear", resizable: true },
    position: { width: 560, height: "auto" },
    form: { handler: BoardConfigApp.#onSubmit, submitOnChange: false, closeOnSubmit: true }
  };

  static PARTS = {
    form: { template: `${PATH}/templates/board-config.hbs`, scrollable: [".ca-scroll"] }
  };

  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    options.uniqueId = options.boardId ?? "board";
    return options;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const board = getBoard(this.boardId);
    context.board = board;
    context.config = board?.config ?? {};
    context.threatChoices = threatChoices();
    context.modeChoices = { public: loc("Config.modePublic"), gm: loc("Config.modeGM") };
    context.revealChoices = { 0: "0", 1: "1", 2: "2", 3: "3" };
    context.hunterChoices = { 0: loc("Config.none"), 1: "NP 1", 2: "NP 2" };
    context.practicalChoices = { 0: loc("Config.none"), 1: "NP 1", 2: "NP 2", 3: "NP 3", 4: "NP 4" };
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    bindUuidDrop(this.element, 'input[data-uuid-drop]');
  }

  /** @this {BoardConfigApp} */
  static async #onSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const c = data.config ?? {};
    const int = (v, min, max, d) => {
      const n = Math.floor(Number(v));
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
    };
    await mutateBoard(this.boardId, board => {
      board.name = String(data.name || board.name).trim();
      const cols = int(data.cols, 2, 80, board.cols);
      const rows = int(data.rows, 2, 80, board.rows);
      if ( cols !== board.cols || rows !== board.rows ) resizeBoard(board, cols, rows, data.fill || "plains");
      Object.assign(board.config, {
        revealRadius: int(c.revealRadius, 0, 3, 1),
        diagonal: !!c.diagonal,
        movesPerDay: int(c.movesPerDay, 1, 50, 3),
        autoRoll: !!c.autoRoll,
        lockOnDanger: !!c.lockOnDanger,
        veteran: !!c.veteran,
        treasureHunter: int(c.treasureHunter, 0, 2, 0),
        practical: int(c.practical, 0, 4, 0),
        messageMode: c.messageMode === "gm" ? "gm" : "public",
        dangerTable: String(c.dangerTable ?? "").trim(),
        discoveryTable: String(c.discoveryTable ?? "").trim(),
        tilt: int(c.tilt, 0, 40, 18),
        partyImg: String(c.partyImg ?? "").trim(),
        backImg: String(c.backImg ?? "").trim(),
        follow: !!c.follow
      });
      return { ok: true };
    });
  }
}

/* -------------------------------------------- */
/*  Terrain library                              */
/* -------------------------------------------- */

export class TerrainLibraryApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.rows = getTerrains().map(t => ({ ...t, name: txt(t.name), description: txt(t.description) }));
  }

  static DEFAULT_OPTIONS = {
    id: "card-atlas-terrains",
    classes: ["card-atlas-editor"],
    tag: "form",
    window: { title: "CARDATLAS.Terrains.title", icon: "fa-solid fa-mountain-sun", resizable: true },
    position: { width: 860, height: 720 },
    form: { handler: TerrainLibraryApp.#onSubmit, submitOnChange: false, closeOnSubmit: true },
    actions: {
      addRow: TerrainLibraryApp.#onAdd,
      deleteRow: TerrainLibraryApp.#onDelete,
      resetDefaults: TerrainLibraryApp.#onReset
    }
  };

  static PARTS = {
    form: { template: `${PATH}/templates/terrain-library.hbs`, scrollable: [".ca-scroll"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.rows = this.rows;
    context.threatChoices = threatChoices();
    return context;
  }

  #capture() {
    const data = readForm(this.element);
    this.rows = toArray(data.terrains).map((r, n) => ({ ...this.rows[n], ...r }));
  }

  /** @this {TerrainLibraryApp} */
  static #onAdd() {
    this.#capture();
    this.rows.push({
      id: `t-${foundry.utils.randomID(8)}`, name: loc("Terrains.newName"), img: "", color: "#6b7a3a",
      threat: "medium", passable: true, banner: false, description: ""
    });
    this.render();
  }

  /** @this {TerrainLibraryApp} */
  static #onDelete(event, target) {
    this.#capture();
    const n = Number(target.closest("[data-row]").dataset.row);
    this.rows.splice(n, 1);
    this.render();
  }

  /** @this {TerrainLibraryApp} */
  static async #onReset() {
    const ok = await DialogV2.confirm({
      window: { title: loc("Terrains.reset") }, content: `<p>${loc("Terrains.resetConfirm")}</p>`, rejectClose: false
    });
    if ( !ok ) return;
    await game.settings.set(MODULE_ID, "terrains", null);
    this.close();
  }

  /** @this {TerrainLibraryApp} */
  static async #onSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const rows = toArray(data.terrains).map((r, n) => ({
      id: String(this.rows[n]?.id || r.id || `t-${foundry.utils.randomID(8)}`),
      name: String(r.name ?? "").trim() || loc("Terrains.newName"),
      img: String(r.img ?? "").trim(),
      color: String(r.color || "#6b7a3a"),
      threat: THREAT_KEYS.includes(r.threat) ? r.threat : "medium",
      passable: !!r.passable,
      banner: !!r.banner,
      description: String(r.description ?? "").trim()
    }));
    await saveTerrains(rows);
  }
}

/* -------------------------------------------- */
/*  Travel options (players' hand)               */
/* -------------------------------------------- */

function choicesToText(choices) {
  return (choices ?? []).map(c => [txt(c.label), txt(c.cost), txt(c.text)].join(" | ").replace(/( \| )+$/, "")).join("\n");
}

function textToChoices(text) {
  return String(text ?? "").split("\n").map(l => l.trim()).filter(Boolean).map(line => {
    const [label = "", cost = "", ...rest] = line.split("|").map(s => s.trim());
    return { label, cost, text: rest.join(" | ") };
  });
}

export class OptionsEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.rows = getOptions().map(o => OptionsEditorApp.toRow(o));
  }

  static toRow(o) {
    return {
      ...o,
      name: txt(o.name),
      description: txt(o.description),
      cost: txt(o.cost),
      prompt: txt(o.prompt),
      source: txt(o.source),
      choicesText: choicesToText(o.choices)
    };
  }

  static DEFAULT_OPTIONS = {
    id: "card-atlas-options",
    classes: ["card-atlas-editor"],
    tag: "form",
    window: { title: "CARDATLAS.Options.title", icon: "fa-solid fa-hand", resizable: true },
    position: { width: 900, height: 760 },
    form: { handler: OptionsEditorApp.#onSubmit, submitOnChange: false, closeOnSubmit: true },
    actions: {
      addRow: OptionsEditorApp.#onAdd,
      deleteRow: OptionsEditorApp.#onDelete,
      moveUp: OptionsEditorApp.#onMoveUp,
      moveDown: OptionsEditorApp.#onMoveDown,
      resetDefaults: OptionsEditorApp.#onReset
    }
  };

  static PARTS = {
    form: { template: `${PATH}/templates/options-editor.hbs`, scrollable: [".ca-scroll"] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.rows = this.rows;
    context.actionChoices = Object.fromEntries(OPTION_ACTIONS.map(a => [a, loc(`Action.${a}`)]));
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    bindUuidDrop(this.element, 'input[data-uuid-drop]');
  }

  #capture() {
    const data = readForm(this.element);
    this.rows = toArray(data.options).map((r, n) => ({ ...this.rows[n], ...r }));
  }

  /** @this {OptionsEditorApp} */
  static #onAdd() {
    this.#capture();
    this.rows.push(OptionsEditorApp.toRow({
      id: `o-${foundry.utils.randomID(8)}`, name: loc("Options.newName"), description: "", source: "",
      icon: "fa-solid fa-star", img: "", cost: "", action: "chat", value: "", step: false,
      gmOnly: false, enabled: true, confirm: true, prompt: "", choices: []
    }));
    this.render();
  }

  /** @this {OptionsEditorApp} */
  static #onDelete(event, target) {
    this.#capture();
    this.rows.splice(Number(target.closest("[data-row]").dataset.row), 1);
    this.render();
  }

  /** @this {OptionsEditorApp} */
  static #onMoveUp(event, target) {
    this.#capture();
    const n = Number(target.closest("[data-row]").dataset.row);
    if ( n > 0 ) [this.rows[n - 1], this.rows[n]] = [this.rows[n], this.rows[n - 1]];
    this.render();
  }

  /** @this {OptionsEditorApp} */
  static #onMoveDown(event, target) {
    this.#capture();
    const n = Number(target.closest("[data-row]").dataset.row);
    if ( n < this.rows.length - 1 ) [this.rows[n + 1], this.rows[n]] = [this.rows[n], this.rows[n + 1]];
    this.render();
  }

  /** @this {OptionsEditorApp} */
  static async #onReset() {
    const ok = await DialogV2.confirm({
      window: { title: loc("Options.reset") }, content: `<p>${loc("Options.resetConfirm")}</p>`, rejectClose: false
    });
    if ( !ok ) return;
    await saveOptions(null);
    this.rows = defaultOptions().map(o => OptionsEditorApp.toRow(o));
    this.close();
  }

  /** @this {OptionsEditorApp} */
  static async #onSubmit(event, form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const list = toArray(data.options).map((r, n) => ({
      id: String(this.rows[n]?.id || `o-${foundry.utils.randomID(8)}`),
      name: String(r.name ?? "").trim() || loc("Options.newName"),
      description: String(r.description ?? "").trim(),
      source: String(r.source ?? "").trim(),
      icon: String(r.icon ?? "").trim() || "fa-solid fa-star",
      img: String(r.img ?? "").trim(),
      cost: String(r.cost ?? "").trim(),
      action: OPTION_ACTIONS.includes(r.action) ? r.action : "chat",
      value: String(r.value ?? "").trim(),
      step: !!r.step,
      gmOnly: !!r.gmOnly,
      enabled: !!r.enabled,
      confirm: !!r.confirm,
      prompt: String(r.prompt ?? "").trim(),
      choices: textToChoices(r.choicesText)
    }));
    await saveOptions(list);
  }
}
