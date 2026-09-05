import type { MiddlewareHandler } from "hono";
import { getAccessToken } from "../../lib/oauth-store";
import { getResourceAudience, verifyJwt } from "../../lib/oidc";
import type { AuthUser } from "../../middleware/auth";

declare module "hono" {
  interface ContextVariableMap {
    devUser: AuthUser;
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
          const access = typeof payload.jti === "string" ? await getAccessToken(payload.jti) : null;
          if (access?.userId === userId && access.identityId === payload.sub) {
            c.set("devUser", {
              id: userId,
              deviceId: null,
              isReadOnly: false,
              authMethod: typeof payload.auth_method === "string" ? payload.auth_method : null,
              enterpriseSsoOrganizationId: typeof payload.org_id === "string" ? payload.org_id : null,
              enterpriseSsoConnectionId: typeof payload.sso_connection_id === "string" ? payload.sso_connection_id : null,
            });
            return next();
          }
        }
      }
    } catch {}
  }

  const sessionUser = c.get("user");
  if (sessionUser?.id) {
    c.set("devUser", sessionUser);
    return next();
  }

  return c.json({ error: "Unauthorized" }, 401);
};

export const requireWritableDevUser: MiddlewareHandler = async (c, next) => {
  const sessionUser = c.get("user");
  if (sessionUser?.isReadOnly || c.get("devUser").isReadOnly) {
    return c.json({ error: "Demo account is read-only" }, 403);
  }

  return next();
};
