import { eq } from "drizzle-orm";
import { db, identities, oauthApps } from "../db";
import { getAccessToken, type AccessTokenRecord } from "./oauth-store";
import { getResourceAudience, verifyJwt } from "./oidc";

function isQuickOAuthClientId(clientId: string): boolean {
  return typeof clientId === "string" && clientId.startsWith("origin:");
}

async function verifyIdentityUserBinding(identityId: string, userId: string): Promise<boolean> {
  const [identity] = await db
    .select({ userId: identities.userId })
    .from(identities)
    .where(eq(identities.id, identityId))
    .limit(1);
  return Boolean(identity && identity.userId === userId);
}

export async function resolveOAuthAccessFromBearer(bearerToken: string): Promise<AccessTokenRecord | null> {
  const trimmed = bearerToken.trim();
  if (!trimmed) return null;

  const opaque = await getAccessToken(trimmed);
  if (opaque) {
    return (await verifyIdentityUserBinding(opaque.identityId, opaque.userId)) ? opaque : null;
  }

  const payload = await verifyJwt(trimmed, getResourceAudience());
  if (!payload) return null;

  const userId = typeof payload.sid === "string" ? payload.sid : "";
  const identityId = typeof payload.sub === "string" ? payload.sub : "";
  const scope = typeof payload.scope === "string" ? payload.scope : "";
  const cid = typeof payload.cid === "string" ? payload.cid : "";
  if (!userId || !identityId || !cid) return null;

  let appId: string;
  if (payload.quick === true && isQuickOAuthClientId(cid)) {
    appId = cid;
  } else {
    const [app] = await db
      .select({ id: oauthApps.id })
      .from(oauthApps)
      .where(eq(oauthApps.clientId, cid))
      .limit(1);
    if (!app) return null;
    appId = app.id;
  }

  const record: AccessTokenRecord = {
    userId,
    identityId,
    appId,
    scope,
    expiresAt: typeof payload.exp === "number" ? payload.exp * 1000 : Date.now() + 60_000,
    redirectUri: "",
  };

  return (await verifyIdentityUserBinding(identityId, userId)) ? record : null;
}

export function oauthTokenAllowsAppScopedSecret(
  oauth: AccessTokenRecord | null | undefined,
  secret: { kind: string; appId: string | null },
): boolean {
  if (!oauth) return true;
  if (secret.kind !== "app_scoped") return true;
  return secret.appId === oauth.appId;
}

export function oauthTokenMatchesAppScopedPayload(
  oauth: AccessTokenRecord | null | undefined,
  payloadAppId: string | undefined,
): boolean {
  if (!oauth) return true;
  if (!payloadAppId) return true;
  return payloadAppId === oauth.appId;
}
