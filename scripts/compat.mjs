/**
 * Foundry v13 / v14 differences used by this module, in one place.
 *
 * Message visibility
 *  - v14: `messageMode` ("public", "gm") in Roll#toMessage and RollTable#draw,
 *         and ChatMessage.applyMode(chatData, mode).
 *  - v13: `rollMode` ("publicroll", "gmroll") in the same calls,
 *         and ChatMessage.applyRollMode(chatData, rollMode).
 * The module stores its own "public" | "gm" and translates here. Detection is by feature
 * (does ChatMessage.applyMode exist?), not by version number.
 *
 * Text with variables (v13 needs i18n.format, v14 passes data to localize) is handled in
 * constants.mjs by interpolating {placeholders} ourselves, so it needs no branch.
 */

const ChatMessageClass = () => foundry.documents.ChatMessage.implementation;

/** True on v14+, where message visibility is a "messageMode". */
export function usesMessageMode() {
  return typeof ChatMessageClass().applyMode === "function";
}

/** Options for Roll#toMessage and RollTable#draw that set who sees the message. */
export function visibilityOptions(mode) {
  const gm = mode === "gm";
  return usesMessageMode()
    ? { messageMode: gm ? "gm" : "public" }
    : { rollMode: gm ? "gmroll" : "publicroll" };
}

/** Apply the visibility to plain ChatMessage data (whisper to the GMs for "gm"). */
export function applyVisibility(chatData, mode) {
  const cls = ChatMessageClass();
  const gm = mode === "gm";
  if ( usesMessageMode() ) return cls.applyMode(chatData, gm ? "gm" : "public");
  return cls.applyRollMode(chatData, gm ? "gmroll" : "publicroll");
}
