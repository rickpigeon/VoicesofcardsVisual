/**
 * Rolling the Travel Roll from a client: the GM's toolbar button or the "Rolar" button in the
 * status line. Depending on the board:
 *  - GM: rolls at once (or ends the day now and rolls it);
 *  - players (rollBy "players"): the player rolls on their own client, the roll is posted as
 *    them, and the GM checks and applies the result;
 *  - Lookfar (config.lookfar, module active): opens Lookfar's Travel Check; the GM reads the
 *    roll back from the chat (lookfar.mjs).
 */
import { loc } from "./constants.mjs";
import { travelDie, travelOutcome } from "./rules.mjs";
import { getBoard } from "./store.mjs";
import { endDayNow, gmTravelRoll, request } from "./engine.mjs";
import { postTravelRoll } from "./chat.mjs";
import { lookfarReady, openLookfarTravel, waitForDice } from "./lookfar.mjs";

/** Should this user see a roll button for the board's pending day? */
export function canRoll(board, user = game.user) {
  if ( !board?.travel?.pending ) return false;
  return user.isGM || board.config.rollBy === "players";
}

export function usesLookfar(board) {
  return !!board?.config.lookfar && lookfarReady();
}

let busy = false;

export async function rollTravelNow(boardId) {
  if ( busy ) return;
  busy = true;
  try {
    let board = getBoard(boardId);
    if ( !board ) return;
    if ( game.user.isGM ) {
      if ( !usesLookfar(board) ) return await gmTravelRoll(boardId);
      if ( !board.travel.pending ) {
        await endDayNow(boardId);
        board = getBoard(boardId);
      }
      return await startLookfar(boardId, board);
    }
    if ( board.config.rollBy !== "players" ) return ui.notifications.warn(loc("Reason.gmRolls"));
    if ( !board.travel.pending ) return ui.notifications.warn(loc("Reason.noPending"));
    if ( usesLookfar(board) ) return await startLookfar(boardId, board);
    return await playerRoll(boardId, board);
  } finally {
    busy = false;
  }
}

async function startLookfar(boardId, board) {
  const res = await request("lookfarStart", { boardId });
  if ( res?.ok ) openLookfarTravel(getBoard(boardId) ?? board);
}

/** A player's own roll: posted as the player, then checked and applied by the GM. */
async function playerRoll(boardId, board) {
  const { day, threat } = board.travel.pending;
  const { baseDie, die } = travelDie(board.config, threat);
  const roll = await new foundry.dice.Roll(`1d${die}`).evaluate();
  const { outcome, discoveryMax } = travelOutcome(board.config, roll.total);
  const r = { day, threat, baseDie, die, total: roll.total, outcome, discoveryMax, reroll: false, roll };
  const speaker = foundry.documents.ChatMessage.implementation.getSpeaker();
  const message = await postTravelRoll(board, r, { speaker });
  await waitForDice(message?.id);
  return request("travelResult", { boardId, day, die, total: roll.total });
}
