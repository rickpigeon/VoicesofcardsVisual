/**
 * Pure board rules: geometry, threat, passability, (de)serialization.
 * No Foundry calls here, so the same code runs in the GM engine, in every client's view
 * and in the local preview harness.
 */

import { ELEMENT_KEYS } from "./constants.mjs";

const THREATS = ["minimal", "low", "medium", "high", "veryHigh"];
const THREAT_DICE = { minimal: 6, low: 8, medium: 10, high: 12, veryHigh: 20 };
const DICE = [6, 8, 10, 12, 20];
export const ROLL_BY = ["auto", "gm", "players"];
export const PARTY_TOKENS = ["party", "banner", "caravan", "ship", "airship", "compass", "custom"];
export const PARTY_FRAMES = ["ring", "none"];

export function defaultConfig() {
  return {
    revealRadius: 1,       // cards turned around the group after each step
    diagonal: false,       // allow diagonal steps (and square reveal)
    movesPerDay: 3,        // cards walked per travel day (LB p. 106: the GM sets the day's length)
    rollBy: "auto",        // who rolls the Travel Roll: auto (at once) | gm | players
    lookfar: false,        // roll through the Lookfar module's Travel Check dialog when it is active
    lockOnDanger: true,    // "unless stopped by a danger..." (LB p. 106)
    veteran: false,        // Viajante Experiente: travel die one step smaller, min d6 (LB p. 177)
    treasureHunter: 0,     // Caçador de Tesouros NP (0-2): discovery on NP+1 or less (LB p. 176)
    practical: 0,          // Prático NP (0-4): reminder to recover NP IP after each roll (LB p. 177)
    messageMode: "public", // visibility of the Travel Roll message
    dangerTable: "",       // RollTable UUID drawn on a danger
    discoveryTable: "",    // RollTable UUID drawn on a discovery
    tilt: 18,              // table tilt in degrees (0 = flat)
    partyToken: "party",   // built-in token art (PARTY_TOKENS) or "custom"
    partyImg: "",          // custom token image (used with partyToken "custom")
    partyFrame: "ring",    // ring (round, golden ring) | none (the image as it is, for cut-out tokens)
    partyColor: "#d8b25e", // ring colour
    partyScale: 100,       // token size in %
    partyLabel: "",        // name shown under the token
    manaChat: true,        // first arrival at a visible mana card adds the mana line to the chat
    manaMessage: "",       // the board's mana message for every element ("" = the default sentence)
    manaMessages: {},      // a message per element, over manaMessage ({ fire: "...", ... })
    backImg: "",           // custom card back
    follow: true           // camera follows the group
  };
}

/** Fill and fix a stored config, including boards saved before 1.1 (autoRoll, partyImg only). */
export function normalizeConfig(raw = {}) {
  const c = { ...defaultConfig(), ...raw };
  if ( !ROLL_BY.includes(raw.rollBy) ) c.rollBy = raw.autoRoll === false ? "gm" : "auto";
  delete c.autoRoll;
  if ( !PARTY_TOKENS.includes(raw.partyToken) ) c.partyToken = raw.partyImg ? "custom" : "party";
  if ( !PARTY_FRAMES.includes(c.partyFrame) ) c.partyFrame = "ring";
  const scale = Math.round(Number(c.partyScale));
  c.partyScale = Number.isFinite(scale) ? Math.min(200, Math.max(50, scale)) : 100;
  c.lookfar = !!c.lookfar;
  c.manaChat = c.manaChat !== false;
  c.manaMessage = cleanText(c.manaMessage);
  const byElement = raw.manaMessages && typeof raw.manaMessages === "object" ? raw.manaMessages : {};
  c.manaMessages = {};
  for ( const k of ELEMENT_KEYS ) {
    const text = cleanText(byElement[k]);
    if ( text ) c.manaMessages[k] = text;
  }
  return c;
}

/** Longest mana message kept (a chat line, not a journal page). */
export const MANA_TEXT_MAX = 600;

function cleanText(value) {
  return typeof value === "string" ? value.trim().slice(0, MANA_TEXT_MAX) : "";
}

/* -------------------------------------------- */
/*  Travel Roll (Livro Básico p. 106-109)        */
/* -------------------------------------------- */

/** Die for a day of the given threat: the threat's die, one step smaller for Viajante Experiente. */
export function travelDie(config, threat) {
  const baseDie = THREAT_DICE[threat] ?? 8;
  const die = config?.veteran ? DICE[Math.max(0, DICE.indexOf(baseDie) - 1)] : baseDie;
  return { baseDie, die };
}

/**
 * Outcome of a Travel Roll: 6+ danger; discovery on 1, or up to NP + 1 with Caçador de Tesouros.
 * `variant` follows Lookfar's variant rules (2-3 is a minor discovery, 1 a major one).
 */
export function travelOutcome(config, total, { variant = false } = {}) {
  const hunter = Math.max(0, Math.min(2, Number(config?.treasureHunter) || 0));
  const discoveryMax = variant ? 3 : 1 + hunter;
  const outcome = total >= 6 ? "danger" : (total <= discoveryMax ? "discovery" : "calm");
  return { outcome, discoveryMax };
}

export function defaultTravel() {
  return { day: 1, steps: 0, dayThreat: null, locked: false, pending: null, last: null };
}

export function index(board, x, y) {
  if ( x < 0 || y < 0 || x >= board.cols || y >= board.rows ) return -1;
  return (y * board.cols) + x;
}

export function coords(board, i) {
  return { x: i % board.cols, y: Math.floor(i / board.cols) };
}

export function cellAt(board, x, y) {
  const i = index(board, x, y);
  return i < 0 ? null : (board.cells[i] ?? null);
}

export function isAdjacent(board, a, b) {
  if ( !a || !b ) return false;
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if ( board.config.diagonal ) return Math.max(dx, dy) === 1;
  return (dx + dy) === 1;
}

export function distance(board, a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return board.config.diagonal ? Math.max(dx, dy) : dx + dy;
}

/** Indices of existing cards within `radius` of (x, y), including the center. */
export function cellsInRadius(board, x, y, radius) {
  const out = [];
  const r = Math.max(0, Math.floor(radius));
  for ( let yy = y - r; yy <= y + r; yy++ ) {
    for ( let xx = x - r; xx <= x + r; xx++ ) {
      const i = index(board, xx, yy);
      if ( i < 0 || !board.cells[i] ) continue;
      if ( distance(board, { x, y }, { x: xx, y: yy }) <= r ) out.push(i);
    }
  }
  return out;
}

/** Turn every card within `radius` face up. Returns the indices that changed. */
export function revealAround(board, x, y, radius) {
  const changed = [];
  for ( const i of cellsInRadius(board, x, y, radius) ) {
    const cell = board.cells[i];
    if ( !cell.revealed ) {
      cell.revealed = true;
      changed.push(i);
    }
  }
  return changed;
}

export function neighbors(board, x, y) {
  const out = [];
  for ( let dy = -1; dy <= 1; dy++ ) {
    for ( let dx = -1; dx <= 1; dx++ ) {
      if ( !dx && !dy ) continue;
      const p = { x: x + dx, y: y + dy };
      if ( !isAdjacent(board, { x, y }, p) ) continue;
      const i = index(board, p.x, p.y);
      if ( i >= 0 && board.cells[i] ) out.push({ ...p, i });
    }
  }
  return out;
}

export function cellThreat(cell, terrains) {
  if ( !cell ) return "low";
  if ( THREATS.includes(cell.threat) ) return cell.threat;
  const t = terrains.get(cell.terrain);
  return THREATS.includes(t?.threat) ? t.threat : "low";
}

export function isPassable(cell, terrains) {
  if ( !cell ) return false;
  if ( typeof cell.passable === "boolean" ) return cell.passable;
  const t = terrains.get(cell.terrain);
  return t ? (t.passable !== false) : true;
}

/** Strip default values so the stored setting stays small. */
export function compactCell(c) {
  if ( !c ) return null;
  const out = { terrain: c.terrain || "plains" };
  if ( c.revealed ) out.revealed = true;
  if ( c.visited ) out.visited = true;
  for ( const k of ["label", "img", "threat", "note", "text", "link", "mana"] ) {
    if ( typeof c[k] === "string" && c[k].trim() ) out[k] = c[k].trim();
  }
  if ( typeof c.passable === "boolean" ) out.passable = c.passable;
  if ( out.mana && c.manaHidden ) out.manaHidden = true;
  const manaText = cleanText(c.manaText);
  if ( out.mana && manaText ) out.manaText = manaText;
  return out;
}

export function compactBoard(board) {
  return {
    id: board.id,
    name: board.name,
    cols: board.cols,
    rows: board.rows,
    cells: board.cells.map(compactCell),
    party: board.party ? { x: board.party.x, y: board.party.y } : null,
    config: normalizeConfig(board.config),
    travel: { ...defaultTravel(), ...board.travel }
  };
}

/** Fill missing fields of a stored (or imported) board. */
export function normalizeBoard(raw) {
  if ( !raw || typeof raw !== "object" ) return null;
  const cols = Math.max(1, Math.min(80, Math.floor(Number(raw.cols) || 1)));
  const rows = Math.max(1, Math.min(80, Math.floor(Number(raw.rows) || 1)));
  const cells = [];
  for ( let i = 0; i < cols * rows; i++ ) {
    const c = Array.isArray(raw.cells) ? raw.cells[i] : null;
    cells.push(c && typeof c === "object" ? { ...c, terrain: c.terrain || "plains" } : null);
  }
  const board = {
    id: String(raw.id || ""),
    name: String(raw.name || "?"),
    cols,
    rows,
    cells,
    party: null,
    config: normalizeConfig(raw.config ?? {}),
    travel: { ...defaultTravel(), ...(raw.travel ?? {}) }
  };
  const p = raw.party;
  if ( p && Number.isInteger(p.x) && Number.isInteger(p.y) && cellAt(board, p.x, p.y) ) board.party = { x: p.x, y: p.y };
  return board;
}

/** Change the grid size, keeping the cards that still fit (new space is filled with `fill`). */
export function resizeBoard(board, cols, rows, fill = "plains") {
  const cells = [];
  for ( let y = 0; y < rows; y++ ) {
    for ( let x = 0; x < cols; x++ ) {
      const old = (x < board.cols && y < board.rows) ? board.cells[(y * board.cols) + x] : undefined;
      cells.push(old === undefined ? { terrain: fill } : old);
    }
  }
  board.cols = cols;
  board.rows = rows;
  board.cells = cells;
  if ( board.party && (board.party.x >= cols || board.party.y >= rows || !cellAt(board, board.party.x, board.party.y)) ) {
    board.party = null;
  }
  return board;
}
