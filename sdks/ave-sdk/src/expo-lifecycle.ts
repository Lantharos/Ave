import type { AveSession } from "./session.js";

export type AppStateChangePayload = string | { nextAppState: string };

export interface AppStateModuleLike {
  addEventListener(event: "change", handler: (state: AppStateChangePayload) => void): { remove?: () => void } | void;
}

function nextAppStateFromPayload(s: AppStateChangePayload): string {
  return typeof s === "string" ? s : s.nextAppState;
}

/**
 * Trigger a silent token refresh when the app returns to foreground (optional edge-case smoother).
 * Returns a cleanup function that removes the listener.
 */
export function onExpoAppForegroundRefresh(
  appState: AppStateModuleLike,
  session: AveSession
): () => void {
  const handler = (s: AppStateChangePayload) => {
    if (nextAppStateFromPayload(s) === "active") {
      void session.getValidIdToken().catch(() => {
        // signed out or no refresh — ignore
      });
    }
  };
  const sub = appState.addEventListener("change", handler);
  return () => {
    if (sub && typeof sub.remove === "function") {
      sub.remove();
    }
  };
}
