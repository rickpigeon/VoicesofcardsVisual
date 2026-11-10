/**
 * Playing a travel option from the hand (client side): collect the choice / text,
 * post the card to chat as the player, then ask the GM for anything that changes the board.
 */
import { esc, loc, txt } from "./constants.mjs";
import { postOptionCard } from "./chat.mjs";
import { needsGM, request } from "./engine.mjs";
import { getBoard, getOptions } from "./store.mjs";

const { DialogV2 } = foundry.applications.api;

export function visibleOptions() {
  return getOptions().filter(o => o.enabled && (!o.gmOnly || game.user.isGM));
}

function dialogBody(option) {
  const div = document.createElement("div");
  div.className = "card-atlas-dialog";
  const desc = txt(option.description);
  if ( desc ) {
    const p = document.createElement("div");
    p.className = "ca-dialog-desc";
    p.innerHTML = desc.split(/\n{2,}/).map(s => `<p>${esc(s).replace(/\n/g, "<br>")}</p>`).join("");
    div.append(p);
  }
  if ( option.choices?.length ) {
    const list = document.createElement("div");
    list.className = "ca-dialog-choices";
    option.choices.forEach((c, n) => {
      const cost = txt(c.cost);
      const text = txt(c.text);
      const label = document.createElement("label");
      label.className = "ca-dialog-choice";
      label.innerHTML = `<input type="radio" name="choice" value="${n}" ${n === 0 ? "checked" : ""}>
        <span><strong>${esc(txt(c.label))}</strong>${cost ? ` <em class="ca-cost">${esc(cost)}</em>` : ""}
        ${text ? `<small>${esc(text)}</small>` : ""}</span>`;
      list.append(label);
    });
    div.append(list);
  }
  if ( option.prompt ) {
    const label = document.createElement("label");
    label.className = "ca-dialog-prompt";
    label.innerHTML = `<span>${esc(txt(option.prompt))}</span><textarea name="text" rows="3"></textarea>`;
    div.append(label);
  }
  if ( option.source ) {
    const s = document.createElement("p");
    s.className = "ca-dialog-source";
    s.textContent = txt(option.source);
    div.append(s);
  }
  return div;
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
  if ( needsGM(option) ) await request("option", { boardId, optionId });
}
