import type { AveSession } from "./session.js";

export type AveSessionState = ReturnType<AveSession["getState"]>;

/**
 * Minimal Svelte-compatible store: `{ subscribe }` matches the contract
 * `subscribe(handler)` — runs immediately and on every session change.
 */
export function aveSessionToStore(session: AveSession) {
  return {
    subscribe: (handler: (value: AveSessionState) => void) => session.subscribe(handler),
  };
}
