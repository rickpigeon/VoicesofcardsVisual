/**
 * Optional bridge to the Lookfar GM Toolkit (github.com/slave2midna/lookfar, MIT).
 *
 * Lookfar has no public API. This bridge only uses what it exposes to every module, checked
 * against its source (2026-05):
 *  - the hook "lookfarShowTravelCheckDialog", which opens its Travel Check dialog;
 *  - the values the dialog restores from localStorage ("lookfar-treasureHunterLevel",
 *    "lookfar-wellTraveled"), filled here from the board's Andarilho settings;
 *  - the dialog's radio inputs name="travelCheck" (value d6...d20), to preselect the day's threat;
 *  - its roll message (speaker alias "Travel Roll" / "Rolagem de Viagem"), which the GM reads
 *    back as the pending day's Travel Roll.
 * If Lookfar is missing or changes any of this, the board keeps using its own roll.
 */
import { THREAT_DIE } from "./constants.mjs";
import { getBoard, getBoards } from "./store.mjs";
import { applyTravelResult } from "./engine.mjs";
import { reportError } from "./errors.mjs";

const ID = "lookfar";
const HOOK = "lookfarShowTravelCheckDialog";
const ALIAS_KEY = "LOOKFAR.TravelCheck.Chat.Alias.Roll";
const ALIASES = ["Travel Roll", "Rolagem de Viagem", ALIAS_KEY];
const DICE = [6, 8, 10, 12, 20];

export function lookfarActive() {
  return !!game.modules.get(ID)?.active;
}

/** Active and listening to its Travel Check hook. */
export function lookfarReady() {
  if ( !lookfarActive() ) return false;
  const events = Hooks.events;
  return events ? !!events[HOOK]?.length : true;
}

function aliases() {
  const set = new Set(ALIASES);
  const here = game.i18n.localize(ALIAS_KEY);
  if ( here ) set.add(here);
  return set;
}

/** Open Lookfar's Travel Check prefilled for the board's pending day. */
export function openLookfarTravel(board) {
  const threat = board.travel.pending?.threat;
  const die = `d${THREAT_DIE[threat] ?? 8}`;
  try {
    localStorage.setItem("lookfar-treasureHunterLevel", String(Math.max(0, Math.min(3, Number(board.config.treasureHunter) || 0))));
    localStorage.setItem("lookfar-wellTraveled", board.config.veteran ? "true" : "false");
  } catch ( err ) {
    console.warn("card-atlas | could not prefill Lookfar", err);
  }
  // Lookfar's own dice reduction applies "Well-Traveled" on top of the threat chosen here.
  const hookId = Hooks.on("renderDialogV2", app => {
    const form = app.element?.querySelector?.("#lookfar-travel-check");
    if ( !form ) return;
    Hooks.off("renderDialogV2", hookId);
    const radio = form.querySelector(`input[name="travelCheck"][value="${die}"]`);
    if ( radio ) radio.checked = true;
  });
  setTimeout(() => Hooks.off("renderDialogV2", hookId), 15000);
  Hooks.call(HOOK);
}

/** Active GM: a roll message from Lookfar's Travel Check becomes the awaited day's roll. */
export function watchLookfarRolls() {
  Hooks.on("createChatMessage", (message, options, userId) => {
    if ( !game.user.isActiveGM || !lookfarActive() ) return;
    capture(message, userId).catch(err => reportError(err, "lookfar"));
  });
}

async function capture(message, userId) {
  if ( message.rolls?.length !== 1 ) return;
  if ( !aliases().has(message.speaker?.alias) ) return;
  const roll = message.rolls[0];
  const term = roll.dice?.[0];
  if ( !term || !DICE.includes(term.faces) ) return;
  const boardId = Object.keys(getBoards()).find(id => {
    const b = getBoard(id);
    return b?.config.lookfar && b.travel.pending && b.travel.awaitLookfar?.userId === userId;
  });
  if ( !boardId ) return;
  let variant = false;
  try { variant = !!game.settings.get(ID, "useVariantTravelRules"); } catch { variant = false; }
  await waitForDice(message.id);
  const board = getBoard(boardId);
  if ( !board?.travel.pending ) return;
  await applyTravelResult(boardId, {
    day: board.travel.pending.day, die: term.faces, total: roll.total, source: "lookfar", variant
  }, game.users.get(userId) ?? game.user);
}

/** With Dice So Nice, wait until the dice land (at most 10 s) before showing the result. */
export function waitForDice(messageId) {
  if ( !game.dice3d || !messageId ) return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { Hooks.off("diceSoNiceRollComplete", hookId); clearTimeout(timer); resolve(); };
    const hookId = Hooks.on("diceSoNiceRollComplete", id => { if ( id === messageId ) done(); });
    const timer = setTimeout(done, 10000);
  });
}
