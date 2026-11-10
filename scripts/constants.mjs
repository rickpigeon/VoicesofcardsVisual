/**
 * Shared constants and tiny helpers. Nothing here touches the database.
 */

export const MODULE_ID = "card-atlas";
export const PATH = `modules/${MODULE_ID}`;
export const QUERY_NAME = `${MODULE_ID}.request`;
export const SOCKET_NAME = `module.${MODULE_ID}`;

/** Threat levels and Travel Roll dice (Fabula Ultima, Livro Básico p. 106-107). */
export const THREAT_KEYS = ["minimal", "low", "medium", "high", "veryHigh"];
export const THREAT_DIE = { minimal: 6, low: 8, medium: 10, high: 12, veryHigh: 20 };
export const DIE_STEPS = [6, 8, 10, 12, 20];

/** Hand-card actions that the GM client has to execute. */
export const GM_ACTIONS = new Set(["travelRoll", "reroll", "reveal"]);
export const OPTION_ACTIONS = ["chat", "travelRoll", "reroll", "reveal", "macro"];

/**
 * Localize a key of this module ("CARDATLAS." is prepended) and fill {placeholders}.
 * The interpolation is done here because v13 only does it in i18n.format() while v14
 * does it in i18n.localize(key, data); this way the same call works on both.
 */
export function loc(key, data) {
  const text = game.i18n.localize(`CARDATLAS.${key}`);
  if ( !data ) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in data ? String(data[name]) : match));
}

/** Names of default content are stored as i18n keys so they follow the user's language. */
export function txt(value) {
  if ( typeof value !== "string" ) return "";
  return value.startsWith("CARDATLAS.") ? game.i18n.localize(value) : value;
}

export function threatOrder(key) {
  const i = THREAT_KEYS.indexOf(key);
  return i < 0 ? 1 : i;
}

/** The highest of two threat levels ("if there is more than one, apply only the highest"). */
export function maxThreat(a, b) {
  if ( !a ) return b || null;
  if ( !b ) return a;
  return threatOrder(a) >= threatOrder(b) ? a : b;
}

/** Reduce a die by N steps, never below d6 (Viajante Experiente, LB p. 177). */
export function stepDownDie(die, steps = 0) {
  const i = DIE_STEPS.indexOf(die);
  if ( i < 0 ) return die;
  return DIE_STEPS[Math.max(0, i - Math.max(0, steps))];
}

export function threatLabel(key) {
  return loc(`Threat.${THREAT_KEYS.includes(key) ? key : "low"}`);
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function esc(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}
