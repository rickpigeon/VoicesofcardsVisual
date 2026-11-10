/**
 * Persistence. Everything lives in world settings, which only a GM may write:
 *  - boards:      { [boardId]: board }
 *  - activeBoard: id of the board the players see
 *  - terrains:    terrain library as { list } ({} = built-in defaults)
 *  - options:     travel options / players' hand as { list } ({} = built-in defaults)
 * Players never write; they ask the active GM through a query (see engine.mjs).
 */
import { MODULE_ID } from "./constants.mjs";
import { defaultOptions, defaultTerrains } from "./defaults.mjs";
import { compactBoard, normalizeBoard } from "./rules.mjs";

export function registerSettings() {
  const hidden = (key, type, def) => game.settings.register(MODULE_ID, key, {
    scope: "world", config: false, type, default: def
  });
  hidden("boards", Object, {});
  hidden("activeBoard", String, "");
  hidden("terrains", Object, {});
  hidden("options", Object, {});

  game.settings.register(MODULE_ID, "movePermission", {
    name: "CARDATLAS.Settings.movePermission.name",
    hint: "CARDATLAS.Settings.movePermission.hint",
    scope: "world", config: true, type: String, default: "all",
    choices: {
      all: "CARDATLAS.Settings.movePermission.all",
      gm: "CARDATLAS.Settings.movePermission.gm"
    }
  });
  game.settings.register(MODULE_ID, "flipSound", {
    name: "CARDATLAS.Settings.flipSound.name",
    hint: "CARDATLAS.Settings.flipSound.hint",
    scope: "world", config: true, type: String, default: `modules/${MODULE_ID}/sounds/flip.wav`
  });
  game.settings.register(MODULE_ID, "volume", {
    name: "CARDATLAS.Settings.volume.name",
    hint: "CARDATLAS.Settings.volume.hint",
    scope: "client", config: true, type: Number, default: 0.6,
    range: { min: 0, max: 1, step: 0.05 }
  });
  game.settings.register(MODULE_ID, "autoOpen", {
    name: "CARDATLAS.Settings.autoOpen.name",
    hint: "CARDATLAS.Settings.autoOpen.hint",
    scope: "client", config: true, type: Boolean, default: true
  });
}

export function getBoards() {
  const raw = game.settings.get(MODULE_ID, "boards");
  return (raw && typeof raw === "object") ? raw : {};
}

export function getBoard(id) {
  if ( !id ) return null;
  return normalizeBoard(getBoards()[id]);
}

export function listBoards() {
  return Object.values(getBoards())
    .filter(b => b?.id)
    .map(b => ({ id: b.id, name: b.name }))
    .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}

export function getActiveBoardId() {
  return game.settings.get(MODULE_ID, "activeBoard") || "";
}

/**
 * Lists are stored wrapped as `{ list: [...] }`: the settings are registered as `Object`, and
 * wrapping keeps the stored value a plain object whatever Foundry does with arrays there.
 * A bare array (stored by version 1.0.0) is still read.
 */
function readList(key) {
  const stored = game.settings.get(MODULE_ID, key);
  if ( Array.isArray(stored) ) return stored;
  if ( Array.isArray(stored?.list) ) return stored.list;
  return null;
}

export function getTerrains() {
  const stored = readList("terrains");
  return stored?.length ? stored : defaultTerrains();
}

export function getTerrainMap() {
  return new Map(getTerrains().map(t => [t.id, t]));
}

export function getOptions() {
  return readList("options") ?? defaultOptions();
}

/* -------------------------------------------- */
/*  GM-only writes                               */
/* -------------------------------------------- */

let queue = Promise.resolve();

/** Run writes one after another so two quick requests never overwrite each other. */
function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

/**
 * Change one board. `fn(board)` may be async and returns a result object;
 * `{write: false}` skips the save. Returns the result.
 */
export function mutateBoard(id, fn) {
  return enqueue(async () => {
    const boards = foundry.utils.deepClone(getBoards());
    const board = normalizeBoard(boards[id]);
    if ( !board ) return { ok: false, reason: "noBoard", write: false };
    const result = (await fn(board)) ?? { ok: true };
    if ( result.write === false ) return result;
    boards[id] = compactBoard(board);
    await game.settings.set(MODULE_ID, "boards", boards);
    return result;
  });
}

export function saveBoard(board) {
  return enqueue(async () => {
    const boards = foundry.utils.deepClone(getBoards());
    boards[board.id] = compactBoard(normalizeBoard(board));
    await game.settings.set(MODULE_ID, "boards", boards);
    return board.id;
  });
}

export function deleteBoard(id) {
  return enqueue(async () => {
    const boards = foundry.utils.deepClone(getBoards());
    delete boards[id];
    await game.settings.set(MODULE_ID, "boards", boards);
    if ( getActiveBoardId() === id ) await game.settings.set(MODULE_ID, "activeBoard", "");
  });
}

export function setActiveBoard(id) {
  return game.settings.set(MODULE_ID, "activeBoard", id || "");
}

/** `null` goes back to the built-in defaults (stored as `{}`, which readList treats as unset). */
export function saveTerrains(list) {
  return game.settings.set(MODULE_ID, "terrains", list ? { list } : {});
}

export function saveOptions(list) {
  return game.settings.set(MODULE_ID, "options", list ? { list } : {});
}
