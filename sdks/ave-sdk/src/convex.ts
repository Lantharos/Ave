import type { AveSession } from "./session.js";

interface ConvexAuthLike {
  setAuth(
    fetchToken: () => Promise<string | null | undefined>
  ): void | (() => void);
}

/**
 * Wire an AveSession to Convex so `getValidIdToken()` runs for every auth check,
 * including proactive refresh. Call after creating the client, and only after
 * you are ready to persist (e.g. post-login).
 *
 * Returns Convex’s **`setAuth`** disposer when provided — call it on unmount to unbind.
 */
export function wireAveSessionToConvex(
  convexClient: ConvexAuthLike,
  session: AveSession
): void | (() => void) {
  return convexClient.setAuth(async () => {
    const token = await session.getValidIdToken();
    return token ?? undefined;
  });
}
