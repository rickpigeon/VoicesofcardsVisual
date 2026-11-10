/**
 * Errors on screen. Foundry only logs a failing click handler to the browser console,
 * which most people never open, so the module shows its own errors as notifications.
 */
import { MODULE_ID } from "./constants.mjs";

const recent = new Map();

/** Log the error and show it as a red notification (the same message at most every 3 s). */
export function reportError(err, where = "") {
  console.error(`${MODULE_ID} |${where ? ` ${where} |` : ""}`, err);
  const message = String(err?.message ?? err ?? "?");
  const now = Date.now();
  if ( now - (recent.get(message) ?? 0) < 3000 ) return;
  recent.set(message, now);
  try {
    ui.notifications?.error(`Atlas de Cartas${where ? ` (${where})` : ""}: ${message}`, { permanent: true });
  } catch ( notifyError ) {
    console.error(notifyError);
  }
}

/** Wrap a handler (sync or async) so a failure is reported instead of disappearing. */
export function guard(fn, where) {
  return function(...args) {
    try {
      const result = fn.apply(this, args);
      if ( result && typeof result.then === "function" ) return result.catch(err => reportError(err, where));
      return result;
    } catch ( err ) {
      reportError(err, where);
    }
  };
}

/** Wrap every handler of an ApplicationV2 `actions` map. */
export function guardActions(actions) {
  return Object.fromEntries(Object.entries(actions).map(([name, fn]) => [name, guard(fn, name)]));
}

/** Errors thrown by the module's own files outside a guarded handler also reach the screen. */
export function watchUncaught() {
  const marker = `/modules/${MODULE_ID}/`;
  const ours = value => String(value?.stack ?? "").includes(marker);
  window.addEventListener("unhandledrejection", event => {
    if ( ours(event.reason) ) reportError(event.reason);
  });
  window.addEventListener("error", event => {
    if ( ours(event.error) || String(event.filename ?? "").includes(marker) ) reportError(event.error ?? event.message);
  });
}
