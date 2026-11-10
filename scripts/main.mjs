/**
 * Atlas de Cartas / Card Atlas: entry point.
 */
import { MODULE_ID, QUERY_NAME, SOCKET_NAME, loc } from "./constants.mjs";
import { getActiveBoardId, registerSettings } from "./store.mjs";
import { handleQuery } from "./engine.mjs";
import { BoardApp } from "./board-app.mjs";

const WATCHED = new Set(["boards", "activeBoard", "terrains", "options", "movePermission"].map(k => `${MODULE_ID}.${k}`));

Hooks.once("init", () => {
  registerSettings();
  // Players ask the active GM to move the group or play a hand card.
  CONFIG.queries[QUERY_NAME] = handleQuery;

  game.keybindings.register(MODULE_ID, "open", {
    name: "CARDATLAS.Keybinding.open",
    editable: [],
    onDown: () => { openBoard(); return true; }
  });
});

Hooks.once("ready", () => {
  game.socket?.on(SOCKET_NAME, onSocket);
  const module = game.modules.get(MODULE_ID);
  if ( module ) module.api = { open: openBoard, BoardApp };
});

/** Every client re-syncs its window when the stored data changes. */
function onSettingChanged(setting) {
  if ( WATCHED.has(setting?.key) ) BoardApp.refreshAll();
}
Hooks.on("createSetting", onSettingChanged);
Hooks.on("updateSetting", onSettingChanged);
Hooks.on("deleteSetting", onSettingChanged);

Hooks.on("getSceneControlButtons", controls => {
  const tokens = controls.tokens;
  if ( !tokens?.tools ) return;
  tokens.tools.cardAtlas = {
    name: "cardAtlas",
    title: "CARDATLAS.Title",
    icon: "fa-solid fa-map",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => openBoard()
  };
});

export function openBoard(boardId) {
  if ( !game.user.isGM && !getActiveBoardId() ) {
    ui.notifications.info(loc("Empty.player"));
    return null;
  }
  return BoardApp.open(boardId);
}

function onSocket(data) {
  if ( !data || typeof data !== "object" ) return;
  if ( data.type === "show" ) {
    if ( game.user.isGM ) return;
    if ( game.settings.get(MODULE_ID, "autoOpen") ) BoardApp.open();
    else ui.notifications.info(loc("Notify.shownPlayer"));
  }
  else if ( data.type === "ping" ) {
    foundry.applications.instances.get("card-atlas-board")?.receivePing(data);
  }
}
