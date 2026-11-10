/**
 * Chat cards: Travel Roll, end of a travel day, first arrival at a card, played travel options.
 * User-written text is escaped; @UUID[...] links still work because chat content is enriched.
 */
import { esc, loc, threatLabel, txt } from "./constants.mjs";
import { applyVisibility, visibilityOptions } from "./compat.mjs";

const CM = () => foundry.documents.ChatMessage.implementation;

function paragraphs(text) {
  const clean = String(text ?? "").trim();
  if ( !clean ) return "";
  return clean.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

function speakerFor(board) {
  return CM().getSpeaker({ alias: board?.name || loc("Title") });
}

/** The Travel Roll itself, posted through Roll#toMessage so dice animations work. */
export async function postTravelRoll(board, r) {
  const mods = [];
  if ( r.die !== r.baseDie ) mods.push(loc("Chat.veteran", { from: `d${r.baseDie}`, to: `d${r.die}` }));
  if ( r.discoveryMax > 1 ) mods.push(loc("Chat.treasureHunter", { max: r.discoveryMax }));
  if ( r.reroll ) mods.push(loc("Chat.rerolled"));
  const practical = Number(board.config.practical) || 0;
  const flavor = `<div class="card-atlas-chat ca-travel is-${r.outcome}">
    <header><i class="fa-solid fa-route"></i> ${esc(loc("Chat.travelTitle", { day: r.day }))}</header>
    <p class="ca-line">${esc(loc("Chat.threatLine", { threat: threatLabel(r.threat), die: `d${r.baseDie}` }))}</p>
    ${mods.map(m => `<p class="ca-mod">${esc(m)}</p>`).join("")}
    <p class="ca-outcome">${esc(loc(`Outcome.${r.outcome}`))}</p>
    <p class="ca-hint">${esc(loc(`OutcomeHint.${r.outcome}`))}</p>
    ${practical ? `<p class="ca-mod">${esc(loc("Chat.practical", { n: practical }))}</p>` : ""}
  </div>`;
  return r.roll.toMessage({ speaker: speakerFor(board), flavor }, visibilityOptions(board.config.messageMode));
}

/** GM-only reminder after a danger: how to resolve it and the damage table (LB p. 108). */
export async function postDangerReminder(board) {
  const rows = [["5+", 10, 30, 40], ["20+", 20, 40, 60], ["40+", 30, 50, 80]];
  const content = `<div class="card-atlas-chat ca-gm">
    <header><i class="fa-solid fa-triangle-exclamation"></i> ${esc(loc("Chat.dangerTitle"))}</header>
    <p>${esc(loc("Chat.dangerHow"))}</p>
    <table class="ca-damage">
      <thead><tr><th>${esc(loc("Chat.level"))}</th><th>${esc(loc("Chat.dmgWeak"))}</th><th>${esc(loc("Chat.dmgStrong"))}</th><th>${esc(loc("Chat.dmgIntense"))}</th></tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
    <p class="ca-hint">${esc(loc(board.config.lockOnDanger ? "Chat.dangerLocked" : "Chat.dangerFree"))}</p>
  </div>`;
  return CM().create(applyVisibility({ content, speaker: speakerFor(board) }, "gm"));
}

/** Draw from the board's danger/discovery table, if one is set. */
export async function drawOutcomeTable(board, outcome) {
  const uuid = outcome === "danger" ? board.config.dangerTable : (outcome === "discovery" ? board.config.discoveryTable : "");
  if ( !uuid ) return null;
  const table = await foundry.utils.fromUuid(uuid);
  if ( table?.documentName !== "RollTable" ) {
    ui.notifications.warn(loc("Notify.badTable", { uuid }));
    return null;
  }
  return table.draw({ displayChat: true, ...visibilityOptions(board.config.messageMode) });
}

/** Autoroll off: tell the GM that a day ended and which die to roll. */
export async function postDayEnd(board, { day, threat }) {
  const content = `<div class="card-atlas-chat ca-gm">
    <header><i class="fa-solid fa-sun"></i> ${esc(loc("Chat.dayEndTitle", { day }))}</header>
    <p>${esc(loc("Chat.dayEndText", { threat: threatLabel(threat) }))}</p>
  </div>`;
  return CM().create(applyVisibility({ content, speaker: speakerFor(board) }, "gm"));
}

/** First arrival at a card that has a message and/or a linked document. */
export async function postEnterMessage(board, cell, terrain) {
  const title = cell.label || txt(terrain?.name) || cell.terrain;
  const link = cell.link ? `<p class="ca-link">@UUID[${esc(cell.link)}]</p>` : "";
  const content = `<div class="card-atlas-chat ca-enter">
    <header><i class="fa-solid fa-location-dot"></i> ${esc(title)}</header>
    ${paragraphs(txt(cell.text))}${link}
  </div>`;
  return CM().create({ content, speaker: speakerFor(board) });
}

/** A travel option played from the hand (posted by the player who played it). */
export async function postOptionCard(option, { choice = null, text = "" } = {}) {
  const icon = option.img
    ? `<img class="ca-opt-img" src="${esc(option.img)}" alt="">`
    : `<i class="${esc(option.icon || "fa-solid fa-star")}"></i>`;
  const cost = txt(option.cost);
  const choiceHtml = choice ? `<div class="ca-choice">
      <strong>${esc(txt(choice.label))}</strong>${txt(choice.cost) ? ` <span class="ca-cost">${esc(txt(choice.cost))}</span>` : ""}
      ${txt(choice.text) ? `<div>${paragraphs(txt(choice.text))}</div>` : ""}
    </div>` : "";
  const said = text ? `<blockquote class="ca-said">${paragraphs(text)}</blockquote>` : "";
  const desc = paragraphs(txt(option.description));
  const source = txt(option.source);
  const content = `<div class="card-atlas-chat ca-option">
    <header>${icon} ${esc(txt(option.name))}${cost ? ` <span class="ca-cost">${esc(cost)}</span>` : ""}</header>
    ${choiceHtml}${said}
    ${desc ? `<details class="ca-rules"><summary>${esc(loc("Chat.rules"))}</summary>${desc}</details>` : ""}
    ${source ? `<footer>${esc(source)}</footer>` : ""}
  </div>`;
  return CM().create({ content, speaker: CM().getSpeaker() });
}
