import { eq, or } from "drizzle-orm";
import { db, identities, oauthApps } from "../db";
import { getAccessToken, type AccessTokenRecord } from "./oauth-store";
import { getResourceAudience, verifyJwtSignatureIssuerExp } from "./oidc";

function isQuickOAuthClientId(clientId: string): boolean {
  return typeof clientId === "string" && clientId.startsWith("origin:");
}

function getOAuthAccessStaticAudiences(): string[] {
  return [...new Set([getResourceAudience(), "https://aveid.net"])];
}

function jwtAudiences(payload: Record<string, unknown>): string[] {
  const aud = payload.aud;
  if (Array.isArray(aud)) {
    return aud.filter((v): v is string => typeof v === "string");
  }
  if (typeof aud === "string") {
    return [aud];
  }
  return [];
}

function isStaticResourceAudience(value: string): boolean {
  return getOAuthAccessStaticAudiences().includes(value);
}

async function oauthAccessJwtAudienceAllowed(payload: Record<string, unknown>): Promise<boolean> {
  const audValues = jwtAudiences(payload);
  if (audValues.length === 0) return false;
  if (audValues.some((a) => isStaticResourceAudience(a))) return true;

  for (const audValue of audValues) {
    const [app] = await db
      .select({ id: oauthApps.id })
      .from(oauthApps)
      .where(or(eq(oauthApps.clientId, audValue), eq(oauthApps.id, audValue)))
      .limit(1);
    if (app) return true;
  }
  return false;
}

async function resolveAppIdFromOAuthJwtPayload(payload: Record<string, unknown>): Promise<string | null> {
  const cid = typeof payload.cid === "string" ? payload.cid : "";

  if (payload.quick === true && isQuickOAuthClientId(cid)) {
    return cid;
  }

  if (cid) {
    const [app] = await db
      .select({ id: oauthApps.id })
      .from(oauthApps)
      .where(eq(oauthApps.clientId, cid))
      .limit(1);
    if (app) return app.id;
  }

  const audValues = jwtAudiences(payload);
  for (const audValue of audValues) {
    if (isStaticResourceAudience(audValue)) continue;

    const [byClient] = await db
      .select({ id: oauthApps.id })
      .from(oauthApps)
      .where(eq(oauthApps.clientId, audValue))
      .limit(1);
    if (byClient) return byClient.id;

    const [byId] = await db
      .select({ id: oauthApps.id })
      .from(oauthApps)
      .where(eq(oauthApps.id, audValue))
      .limit(1);
    if (byId) return byId.id;
  }

  return null;
}

async function verifyIdentityUserBinding(identityId: string, userId: string): Promise<boolean> {
  const [identity] = await db
    .select({ userId: identities.userId })
    .from(identities)
    .where(eq(identities.id, identityId))
    .limit(1);
  return Boolean(identity && identity.userId === userId);
}

export async function resolveOAuthAppInternalId(ref: string): Promise<string | null> {
  const [byId] = await db
    .select({ id: oauthApps.id })
    .from(oauthApps)
    .where(eq(oauthApps.id, ref))
    .limit(1);
  if (byId) return byId.id;

  const [byClient] = await db
    .select({ id: oauthApps.id })
    .from(oauthApps)
    .where(eq(oauthApps.clientId, ref))
    .limit(1);
  if (byClient) return byClient.id;

  return null;
}

export async function resolveOAuthAccessFromBearer(bearerToken: string): Promise<AccessTokenRecord | null> {
  const trimmed = bearerToken.trim();
  if (!trimmed) return null;

  const opaque = await getAccessToken(trimmed);
  if (opaque) {
    return (await verifyIdentityUserBinding(opaque.identityId, opaque.userId)) ? opaque : null;
  }

  const payload = await verifyJwtSignatureIssuerExp(trimmed);
  if (!payload) return null;
  if (!(await oauthAccessJwtAudienceAllowed(payload))) return null;

  const userId = typeof payload.sid === "string" ? payload.sid : "";
  const identityId = typeof payload.sub === "string" ? payload.sub : "";
  const scope = typeof payload.scope === "string" ? payload.scope : "";
  if (!userId || !identityId) return null;

  const appId = await resolveAppIdFromOAuthJwtPayload(payload);
  if (!appId) return null;

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

export async function oauthTokenMatchesAppScopedPayload(
  oauth: AccessTokenRecord | null | undefined,
  payloadAppId: string | undefined,
): Promise<boolean> {
  if (!oauth) return true;
  if (!payloadAppId) return true;
  if (payloadAppId === oauth.appId) return true;
  const resolved = await resolveOAuthAppInternalId(payloadAppId);
  return resolved === oauth.appId;
}

export async function oauthQueryAppIdMatchesAccessToken(
  oauth: AccessTokenRecord | null | undefined,
  requestedAppId: string | null | undefined,
): Promise<boolean> {
  if (!oauth) return true;
  if (!requestedAppId) return true;
  if (requestedAppId === oauth.appId) return true;
  const resolved = await resolveOAuthAppInternalId(requestedAppId);
  return resolved === oauth.appId;
}
