import type { AveSession } from "./session.js";

export interface AppStateModuleLike {
  addEventListener(event: "change", handler: (state: { nextAppState: string }) => void): { remove?: () => void } | void;
}

/**
 * Trigger a silent token refresh when the app returns to foreground (optional edge-case smoother).
 * Returns a cleanup function that removes the listener.
 */
export function onExpoAppForegroundRefresh(
  appState: AppStateModuleLike,
  session: AveSession
): () => void {
  const handler = (s: { nextAppState: string }) => {
    if (s.nextAppState === "active") {
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
