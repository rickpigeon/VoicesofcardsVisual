/**
 * Playing a travel option from the hand (client side): collect the choice / text,
 * post the card to chat as the player, then ask the GM for anything that changes the board.
 */
import { esc, loc, txt } from "./constants.mjs";
import { postOptionCard } from "./chat.mjs";
import { needsGM, request } from "./engine.mjs";
import { getBoard, getOptions } from "./store.mjs";
import { rollTravelNow } from "./travel.mjs";

const { DialogV2 } = foundry.applications.api;

export function visibleOptions() {
  return getOptions().filter(o => o.enabled && (!o.gmOnly || game.user.isGM));
}

/**
 * Dialog content as an HTML string (every user value escaped). Foundry cleans string content,
 * and all the tags and attributes used here are on its allowed list; a string works in every
 * v13 and v14 build.
 */
function dialogBody(option) {
  const parts = [];
  const desc = txt(option.description);
  if ( desc ) {
    const paragraphs = desc.split(/\n{2,}/).map(s => `<p>${esc(s).split("\n").join("<br>")}</p>`).join("");
    parts.push(`<div class="ca-dialog-desc">${paragraphs}</div>`);
  }
  if ( option.choices?.length ) {
    const items = option.choices.map((c, n) => {
      const cost = txt(c.cost);
      const text = txt(c.text);
      return `<label class="ca-dialog-choice"><input type="radio" name="choice" value="${n}" ${n === 0 ? "checked" : ""}>
        <span><strong>${esc(txt(c.label))}</strong>${cost ? ` <em class="ca-cost">${esc(cost)}</em>` : ""}
        ${text ? `<small>${esc(text)}</small>` : ""}</span></label>`;
    }).join("");
    parts.push(`<div class="ca-dialog-choices">${items}</div>`);
  }
  if ( option.prompt ) {
    parts.push(`<label class="ca-dialog-prompt"><span>${esc(txt(option.prompt))}</span><textarea name="text" rows="3"></textarea></label>`);
  }
  if ( option.source ) parts.push(`<p class="ca-dialog-source">${esc(txt(option.source))}</p>`);
  return `<div class="card-atlas-dialog">${parts.join("")}</div>`;
}

export async function playOption(boardId, optionId) {
  const option = getOptions().find(o => o.id === optionId);
  if ( !option?.enabled ) return;
  if ( option.gmOnly && !game.user.isGM ) return;
  const title = txt(option.name);
  let choice = null;
  let text = "";

  if ( option.choices?.length || option.prompt ) {
    const data = await DialogV2.input({
      window: { title, icon: option.icon || "fa-solid fa-star" },
      classes: ["card-atlas-dialog-app"],
      content: dialogBody(option),
      ok: { label: loc("Hand.play"), icon: "fa-solid fa-hand" },
      rejectClose: false
    });
    if ( !data ) return;
    if ( option.choices?.length ) choice = option.choices[Number(data.choice) || 0] ?? null;
    text = String(data.text ?? "").trim();
    if ( option.prompt && !text && !option.choices?.length ) return;
  }
  else if ( option.confirm ) {
    const ok = await DialogV2.confirm({
      window: { title, icon: option.icon || "fa-solid fa-star" },
      classes: ["card-atlas-dialog-app"],
      content: dialogBody(option),
      yes: { label: loc("Hand.play"), icon: "fa-solid fa-hand" },
      no: { label: loc("Common.cancel"), icon: "fa-solid fa-xmark" },
      rejectClose: false
    });
    if ( !ok ) return;
  }

  if ( option.action === "macro" ) {
    const macro = option.value ? await foundry.utils.fromUuid(option.value) : null;
    if ( macro?.documentName !== "Macro" ) {
      ui.notifications.warn(loc("Notify.badMacro"));
      return;
    }
    // Script macros receive `scope` values as local variables.
    return macro.execute({ board: getBoard(boardId), option, choice, text });
  }

  await postOptionCard(option, { choice, text });
  // With players rolling, a "Travel Roll" card rolls the pending day on this player's client.
  const board = getBoard(boardId);
  if ( option.action === "travelRoll" && !option.step && board?.travel.pending && board.config.rollBy === "players" ) {
    return rollTravelNow(boardId);
  }
  if ( needsGM(option) ) await request("option", { boardId, optionId });
}
