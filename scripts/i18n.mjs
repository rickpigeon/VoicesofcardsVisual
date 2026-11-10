/**
 * Module language. Foundry only loads a module's translation for the core language, so with
 * Foundry in English this module would show English. By default (client setting "language" =
 * "pt-BR") the Portuguese file is loaded here and merged over Foundry's dictionary after
 * i18nInit: every CARDATLAS.* text (windows, settings, keybinding, chat) is then in Portuguese.
 * "foundry" keeps Foundry's choice (English, or Portuguese when the core language is pt-BR).
 */
import { MODULE_ID } from "./constants.mjs";

let data = null;
let ready = false;

function wanted() {
  try {
    return game.settings.get(MODULE_ID, "language") || "pt-BR";
  } catch {
    return "pt-BR";
  }
}

/** Called in `init`, after the settings are registered. */
export function startLanguage() {
  if ( wanted() !== "pt-BR" ) return;
  fetch(new URL("../lang/pt-BR.json", import.meta.url))
    .then(response => response.json())
    .then(json => {
      data = json;
      merge();
    })
    .catch(err => console.error(`${MODULE_ID} | could not load lang/pt-BR.json`, err));
}

Hooks.once("i18nInit", () => {
  ready = true;
  merge();
});

function merge() {
  if ( !data || !ready ) return;
  if ( game.i18n.lang === "pt-BR" ) return; // Foundry already loaded it
  foundry.utils.mergeObject(game.i18n.translations, data, { inplace: true });
  // Anything already drawn with the other language (e.g. a window opened very early).
  foundry.applications.instances.get("card-atlas-board")?.render();
}
