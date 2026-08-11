import type { MiddlewareHandler } from "hono";
import { getResourceAudience, verifyJwt } from "../../lib/oidc";

declare module "hono" {
  interface ContextVariableMap {
    devUserId: string;
    devAuthMethod?: string | null;
  }
}

export const requireDevUser: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = await verifyJwt(token, getResourceAudience());

      if (payload) {
        const devPortalClientId = process.env.DEV_PORTAL_CLIENT_ID;
        const userId = typeof payload.uid === "string" ? payload.uid : null;
        const tokenClientId = typeof payload.cid === "string" ? payload.cid : "";
        const tokenScopes = typeof payload.scope === "string" ? payload.scope.split(/\s+/).filter(Boolean) : [];
        if (devPortalClientId && tokenClientId === devPortalClientId && userId && tokenScopes.includes("user_id") && payload.quick !== true) {
          c.set("devUserId", userId);
          c.set("devAuthMethod", null);
          return next();
        }
      }
    } catch {}
  }

  const sessionUser = c.get("user");
  if (sessionUser?.id) {
    c.set("devUserId", sessionUser.id);
    c.set("devAuthMethod", sessionUser.authMethod || null);
    return next();
  }

  return c.json({ error: "Unauthorized" }, 401);
};

export const requireWritableDevUser: MiddlewareHandler = async (c, next) => {
  const sessionUser = c.get("user");
  if (sessionUser?.isReadOnly) {
    return c.json({ error: "Demo account is read-only" }, 403);
  }

  return next();
};
