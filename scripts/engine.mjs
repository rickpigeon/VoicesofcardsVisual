/**
 * Rules engine. Every change to a board runs on a GM client: players send a query to the
 * active GM (request()), the GM validates, writes the world setting, and every client
 * animates the difference when the setting update arrives.
 */
import { GM_ACTIONS, MODULE_ID, QUERY_NAME, THREAT_DIE, clamp, loc, maxThreat, stepDownDie } from "./constants.mjs";
import { cellAt, cellThreat, isAdjacent, isPassable, revealAround } from "./rules.mjs";
import { getActiveBoardId, getBoard, getOptions, getTerrainMap, mutateBoard } from "./store.mjs";
import { drawOutcomeTable, postDangerReminder, postDayEnd, postEnterMessage, postTravelRoll } from "./chat.mjs";

const fail = reason => ({ ok: false, reason, write: false });
const wait = ms => new Promise(r => setTimeout(r, ms));

/* -------------------------------------------- */
/*  Client side: ask the GM                      */
/* -------------------------------------------- */

/** Run an action on the GM. A GM runs it locally. Shows a warning when it is refused. */
export async function request(action, data = {}) {
  const payload = { ...data, action, userId: game.user.id };
  let result;
  if ( game.user.isGM ) result = await handleQuery(payload);
  else {
    const gm = game.users.activeGM;
    if ( !gm ) {
      ui.notifications.warn(loc("Notify.noGM"));
      return { ok: false, reason: "noGM" };
    }
    try {
      result = await gm.query(QUERY_NAME, payload, { timeout: 15000 });
    } catch(err) {
      console.error(`${MODULE_ID} |`, err);
      ui.notifications.error(loc("Notify.queryFailed"));
      return { ok: false, reason: "queryFailed" };
    }
  }
  if ( result && !result.ok && result.reason ) ui.notifications.warn(loc(`Reason.${result.reason}`));
  return result ?? { ok: false };
}

/** Query handler registered in CONFIG.queries. Only the GM answers. */
export async function handleQuery(data = {}) {
  if ( !game.user.isGM ) return fail("notGM");
  const user = game.users.get(data.userId);
  if ( !user ) return fail("noUser");
  const isGM = user.isGM;
  if ( !isGM && data.boardId !== getActiveBoardId() ) return fail("notActive");
  try {
    switch ( data.action ) {
      case "walk": {
        if ( !isGM && game.settings.get(MODULE_ID, "movePermission") !== "all" ) return fail("gmOnlyMove");
        return strip(await walk(data.boardId, Number(data.x), Number(data.y), { gm: isGM }));
      }
      case "option": return strip(await runOption(data.boardId, String(data.optionId), user));
      default: return fail("unknownAction");
    }
  } catch(err) {
    console.error(`${MODULE_ID} |`, err);
    return fail("error");
  }
}

function strip(result) {
  return { ok: !!result?.ok, reason: result?.reason ?? null };
}

/* -------------------------------------------- */
/*  Movement                                     */
/* -------------------------------------------- */

/** One step of the group to an adjacent card, with all travel bookkeeping. */
export async function walk(boardId, x, y, { gm = false } = {}) {
  const terrains = getTerrainMap();
  const effects = [];
  const result = await mutateBoard(boardId, async board => {
    if ( !board.party ) return fail("noParty");
    if ( board.travel.locked && !gm ) return fail("locked");
    const target = cellAt(board, x, y);
    if ( !target ) return fail("noCard");
    if ( !isAdjacent(board, board.party, { x, y }) ) return fail("notAdjacent");
    if ( !isPassable(target, terrains) ) {
      // Walking into a hidden obstacle turns it face up, so everyone sees why.
      if ( !target.revealed ) {
        target.revealed = true;
        return { ok: false, reason: "impassable" };
      }
      return fail("impassable");
    }
    const t = board.travel;
    if ( !t.dayThreat ) t.dayThreat = cellThreat(cellAt(board, board.party.x, board.party.y), terrains);
    board.party = { x, y };
    const firstVisit = !target.visited;
    target.visited = true;
    revealAround(board, x, y, board.config.revealRadius);
    if ( firstVisit && (target.text || target.link) ) effects.push({ type: "enter", cell: { ...target } });
    await countStep(board, terrains, effects, cellThreat(target, terrains));
    return { ok: true };
  });
  await runEffects(boardId, effects, terrains);
  return result;
}

/** GM places the group anywhere (no travel day is spent). */
export async function placeParty(boardId, x, y) {
  return mutateBoard(boardId, board => {
    const cell = cellAt(board, x, y);
    if ( !cell ) return fail("noCard");
    board.party = { x, y };
    cell.visited = true;
    revealAround(board, x, y, board.config.revealRadius);
    board.travel.dayThreat = null;
    return { ok: true };
  });
}

async function countStep(board, terrains, effects, threat) {
  const t = board.travel;
  t.steps += 1;
  t.dayThreat = maxThreat(t.dayThreat, threat);
  if ( t.steps >= Math.max(1, Number(board.config.movesPerDay) || 1) ) await endDay(board, terrains, effects);
}

/** Close the current travel day: roll (or flag the roll for the GM) and start the next one. */
async function endDay(board, terrains, effects, { manual = false } = {}) {
  const t = board.travel;
  const here = board.party ? cellAt(board, board.party.x, board.party.y) : null;
  const threat = t.dayThreat || cellThreat(here, terrains);
  if ( board.config.autoRoll || manual ) {
    effects.push({ type: "travel", r: await rollTravel(board, threat, t.day) });
    t.pending = null;
  }
  else {
    t.pending = { threat, day: t.day };
    effects.push({ type: "dayEnd", day: t.day, threat });
  }
  t.day += 1;
  t.steps = 0;
  t.dayThreat = here ? cellThreat(here, terrains) : null;
}

/* -------------------------------------------- */
/*  Travel Roll (Livro Básico p. 106-109)        */
/* -------------------------------------------- */

async function rollTravel(board, threat, day, { reroll = false, die = null } = {}) {
  const baseDie = THREAT_DIE[threat] ?? 8;
  const useDie = die ?? (board.config.veteran ? stepDownDie(baseDie, 1) : baseDie);
  const roll = await new foundry.dice.Roll(`1d${useDie}`).evaluate();
  const total = roll.total;
  const discoveryMax = 1 + clamp(Number(board.config.treasureHunter) || 0, 0, 2);
  const outcome = total >= 6 ? "danger" : (total <= discoveryMax ? "discovery" : "calm");
  const last = { day, threat, baseDie, die: useDie, total, outcome, discoveryMax, reroll };
  const prev = board.travel.last;
  board.travel.last = last;
  if ( board.config.lockOnDanger ) {
    if ( outcome === "danger" ) board.travel.locked = true;
    else if ( reroll && prev?.outcome === "danger" ) board.travel.locked = false;
  }
  return { ...last, roll };
}

/** GM button: roll the pending day, or end the current day now and roll it. */
export async function gmTravelRoll(boardId) {
  const terrains = getTerrainMap();
  const effects = [];
  const result = await mutateBoard(boardId, async board => {
    const t = board.travel;
    if ( t.pending ) {
      effects.push({ type: "travel", r: await rollTravel(board, t.pending.threat, t.pending.day) });
      t.pending = null;
    }
    else await endDay(board, terrains, effects, { manual: true });
    return { ok: true };
  });
  await runEffects(boardId, effects, terrains);
  return result;
}

/** Roll the last Travel Roll again and keep the new result (Cartografia, Atlas Natural p. 130). */
export async function rerollTravel(boardId) {
  const terrains = getTerrainMap();
  const effects = [];
  const result = await mutateBoard(boardId, async board => {
    const last = board.travel.last;
    if ( !last ) return fail("noRoll");
    effects.push({ type: "travel", r: await rollTravel(board, last.threat, last.day, { reroll: true, die: last.die }) });
    return { ok: true };
  });
  await runEffects(boardId, effects, terrains);
  return result;
}

/** Reveal cards around the group, optionally spending one card of the travel day. */
export async function revealAroundParty(boardId, radius, { step = false } = {}) {
  const terrains = getTerrainMap();
  const effects = [];
  const result = await mutateBoard(boardId, async board => {
    if ( !board.party ) return fail("noParty");
    revealAround(board, board.party.x, board.party.y, clamp(Number(radius) || 1, 0, 6));
    if ( step ) await countStep(board, terrains, effects, cellThreat(cellAt(board, board.party.x, board.party.y), terrains));
    return { ok: true };
  });
  await runEffects(boardId, effects, terrains);
  return result;
}

/** Hand cards that need the GM: Travel Roll, reroll, reveal, or anything that spends a step. */
export async function runOption(boardId, optionId, user) {
  const option = getOptions().find(o => o.id === optionId);
  if ( !option || !option.enabled ) return fail("noOption");
  if ( option.gmOnly && !user.isGM ) return fail("gmOnlyOption");
  switch ( option.action ) {
    case "travelRoll": return gmTravelRoll(boardId);
    case "reroll": return rerollTravel(boardId);
    case "reveal": return revealAroundParty(boardId, option.value || 1, { step: option.step });
    default: {
      if ( !option.step ) return { ok: true };
      const terrains = getTerrainMap();
      const effects = [];
      const result = await mutateBoard(boardId, async board => {
        const here = board.party ? cellAt(board, board.party.x, board.party.y) : null;
        await countStep(board, terrains, effects, cellThreat(here, terrains));
        return { ok: true };
      });
      await runEffects(boardId, effects, terrains);
      return result;
    }
  }
}

export function needsGM(option) {
  return GM_ACTIONS.has(option.action) || !!option.step;
}

/* -------------------------------------------- */
/*  GM board edits                               */
/* -------------------------------------------- */

/** Apply cell patches: [{i, data}] merges data into the card; data === null removes the card. */
export function patchCells(boardId, patches) {
  return mutateBoard(boardId, board => {
    for ( const { i, data } of patches ) {
      if ( i < 0 || i >= board.cells.length ) continue;
      if ( data === null ) {
        board.cells[i] = null;
        continue;
      }
      board.cells[i] = { ...(board.cells[i] ?? { terrain: "plains" }), ...data };
    }
    if ( board.party && !cellAt(board, board.party.x, board.party.y) ) board.party = null;
    return { ok: true };
  });
}

export function setAllRevealed(boardId, revealed) {
  return mutateBoard(boardId, board => {
    for ( const c of board.cells ) if ( c ) c.revealed = revealed;
    if ( !revealed && board.party ) revealAround(board, board.party.x, board.party.y, board.config.revealRadius);
    return { ok: true };
  });
}

export function setLocked(boardId, locked) {
  return mutateBoard(boardId, board => {
    board.travel.locked = !!locked;
    return { ok: true };
  });
}

export function resetTravel(boardId) {
  return mutateBoard(boardId, board => {
    board.travel = { day: 1, steps: 0, dayThreat: null, locked: false, pending: null, last: null };
    for ( const c of board.cells ) if ( c ) c.visited = false;
    if ( board.party ) cellAt(board, board.party.x, board.party.y).visited = true;
    return { ok: true };
  });
}

/* -------------------------------------------- */
/*  Effects (chat) after the write               */
/* -------------------------------------------- */

async function runEffects(boardId, effects, terrains) {
  if ( !effects.length ) return;
  const board = getBoard(boardId);
  if ( !board ) return;
  for ( const e of effects ) {
    try {
      if ( e.type === "enter" ) await postEnterMessage(board, e.cell, terrains.get(e.cell.terrain));
      else if ( e.type === "dayEnd" ) await postDayEnd(board, e);
      else if ( e.type === "travel" ) {
        await wait(650); // let the cards finish turning first
        await postTravelRoll(board, e.r);
        if ( e.r.outcome === "danger" ) await postDangerReminder(board);
        await drawOutcomeTable(board, e.r.outcome);
      }
    } catch(err) {
      console.error(`${MODULE_ID} |`, err);
    }
  }
}
