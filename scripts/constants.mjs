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

/**
 * Elements for latent mana: Fabula Ultima's damage types except physical (Livro Básico).
 * Keys match the projectfu system's damage types; names come from CARDATLAS.Element.*.
 */
export const ELEMENTS = {
  air: { icon: "fa-solid fa-wind", color: "#9be7c4" },
  bolt: { icon: "fa-solid fa-bolt", color: "#ffe34d" },
  dark: { icon: "fa-solid fa-moon", color: "#a77bff" },
  earth: { icon: "fa-solid fa-mountain", color: "#d3a356" },
  fire: { icon: "fa-solid fa-fire", color: "#ff7a2f" },
  ice: { icon: "fa-solid fa-snowflake", color: "#8fe3ff" },
  light: { icon: "fa-solid fa-sun", color: "#fff1a8" },
  poison: { icon: "fa-solid fa-skull-crossbones", color: "#d670a0" }
};
export const ELEMENT_KEYS = Object.keys(ELEMENTS);

export function elementLabel(key) {
  return ELEMENTS[key] ? loc(`Element.${key}`) : "";
}

/** Placeholders the GM can write in a latent mana message; both languages work everywhere. */
const MANA_FIELDS = { elemento: "element", element: "element", lugar: "place", place: "place" };

/**
 * Fill {elemento}/{element} and {lugar}/{place} in a mana message.
 * A `place` of null keeps the place placeholder as it is (for previews without a card).
 */
export function fillManaText(template, { element = "", place = null } = {}) {
  const values = { element, place };
  return String(template ?? "").replace(/[{]([A-Za-z]+)[}]/g, (match, name) => {
    const field = MANA_FIELDS[name];
    if ( !field || values[field] === null ) return match;
    return String(values[field]);
  });
}

/** The board-level mana message for an element: its own text, else the general one, else the default. */
export function manaTemplate(config, element) {
  const pick = v => (typeof v === "string" ? v.trim() : "");
  return pick(config?.manaMessages?.[element]) || pick(config?.manaMessage) || loc("Chat.mana");
}

/**
 * The latent mana line of a card: the card's own message, else the board's (see manaTemplate).
 * Returns "" when the card has no mana.
 */
export function manaMessage(config, cell, place = null) {
  if ( !ELEMENTS[cell?.mana] ) return "";
  const own = typeof cell.manaText === "string" ? cell.manaText.trim() : "";
  return fillManaText(own || manaTemplate(config, cell.mana), { element: elementLabel(cell.mana), place });
}

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

/** Yes/No buttons in this module's language (Foundry's own labels follow the core language). */
export function confirmButtons() {
  return {
    yes: { label: loc("Common.yes"), icon: "fa-solid fa-check" },
    no: { label: loc("Common.no"), icon: "fa-solid fa-xmark" }
  };
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function esc(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}
