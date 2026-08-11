import { db, oauthApps, oauthRefreshTokens, identities, organizationIdentityMembers, organizations } from "../../db";
import { eq } from "drizzle-orm";
import { randomUUID, timingSafeEqual } from "crypto";
import { hashSessionToken } from "../../lib/crypto";
import { getIssuer, getResourceAudience, signJwt, verifyJwt, hashToken } from "../../lib/oidc";
import { getAccessToken, setAccessToken, setAuthorizationCode, type AccessTokenRecord } from "../../lib/oauth-store";
import { serializeIdentityForApp } from "../../lib/identity-serialization";
import { isOriginAllowedForApp, normalizeRedirectUri } from "../../lib/redirect-uri";
import { scopesForRole, type BusinessRole } from "../../lib/business";
import { serializeEncryptionPolicy } from "../../lib/business-encryption";
import { parseOAuthScopes, normalizeScopeToken } from "../../lib/oauth-scopes";
import { buildQuickApp, isQuickClient } from "./quick-client";

export { buildQuickApp, getQuickOrigin, isQuickClient } from "./quick-client";

export function getDiscoveryBase(): string {
  return process.env.OIDC_DISCOVERY_BASE || "https://api.aveid.net";
}

export function publicCache(c: any, maxAgeSeconds: number): void {
  c.header("Cache-Control", `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 6}`);
  c.header("CDN-Cache-Control", `public, s-maxage=${maxAgeSeconds}`);
}

// Generate authorization code
export function generateAuthCode(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

// Generate opaque access token
export function generateAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function isValidPkceCodeVerifier(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  const maxLength = Math.max(aBuffer.length, bBuffer.length);
  const paddedA = Buffer.alloc(maxLength);
  const paddedB = Buffer.alloc(maxLength);
  aBuffer.copy(paddedA);
  bBuffer.copy(paddedB);
  const lengthMismatch = aBuffer.length ^ bBuffer.length;
  return timingSafeEqual(paddedA, paddedB) && lengthMismatch === 0;
}

export function isClientSecretValid(expectedHash: string, clientSecret: string): boolean {
  return timingSafeEqualString(hashSessionToken(clientSecret), expectedHash);
}

export function isAllowedPublicClientRequest(c: any, app: Pick<typeof oauthApps.$inferSelect, "redirectUris" | "developmentMode" | "websiteUrl">): boolean {
  const origin = c.req.header("Origin");
  return !origin || isOriginAllowedForApp(app, origin);
}

// Generate refresh token
export function generateRefreshToken(): string {
  return `rt_${randomUUID().replace(/-/g, "")}`;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function parseScopes(scope: string): string[] {
  return parseOAuthScopes(scope);
}

export async function markRefreshTokenFamilyReuse(familyId: string, detectedAt = new Date()): Promise<void> {
  await db
    .update(oauthRefreshTokens)
    .set({ reuseDetectedAt: detectedAt })
    .where(eq(oauthRefreshTokens.familyId, familyId));
}

export function normalizeOauthTokenPayload(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const raw = input as Record<string, unknown>;

  return {
    ...raw,
    grantType: raw.grantType ?? raw.grant_type,
    redirectUri: typeof (raw.redirectUri ?? raw.redirect_uri) === "string"
      ? normalizeRedirectUri(String(raw.redirectUri ?? raw.redirect_uri))
      : raw.redirectUri ?? raw.redirect_uri,
    clientId: raw.clientId ?? raw.client_id,
    clientSecret: raw.clientSecret ?? raw.client_secret,
    codeVerifier: raw.codeVerifier ?? raw.code_verifier,
    refreshToken: raw.refreshToken ?? raw.refresh_token,
    subjectToken: raw.subjectToken ?? raw.subject_token,
    requestedResource: raw.requestedResource ?? raw.resource,
    requestedScope: raw.requestedScope ?? raw.scope,
  };
}

export function getWebBase(): string {
  return process.env.RP_ORIGIN || "https://aveid.net";
}

export function getApiBase(): string {
  return process.env.OIDC_DISCOVERY_BASE || "https://api.aveid.net";
}

export function hasScope(scope: string, requested: string): boolean {
  return parseScopes(scope).includes(normalizeScopeToken(requested));
}

export function hasAllScopes(grantedScope: string, requestedScope: string): boolean {
  const granted = new Set(parseScopes(grantedScope));
  return parseScopes(requestedScope).every((scope) => granted.has(scope));
}

export function organizationClaims(record: {
  organizationId?: string;
  organizationName?: string;
  organizationMemberId?: string;
  organizationRole?: string;
  organizationScopes?: string[];
  organizationSigningAuthority?: boolean;
  organizationEncryptionMode?: string;
  organizationKeyCustody?: string;
  organizationAuthMethod?: string;
  organizationSsoConnectionId?: string;
}) {
  if (!record.organizationId) return {};
  return {
    org_id: record.organizationId,
    org_name: record.organizationName,
    org_member_id: record.organizationMemberId,
    org_role: record.organizationRole,
    org_scopes: record.organizationScopes,
    org_signing_authority: record.organizationSigningAuthority,
    org_encryption_mode: record.organizationEncryptionMode,
    org_key_custody: record.organizationKeyCustody,
    auth_method: record.organizationAuthMethod,
    sso_connection_id: record.organizationSsoConnectionId,
    auth_context: "organization",
  };
}

export function organizationResponse(record: {
  organizationId?: string;
  organizationName?: string;
  organizationMemberId?: string;
  organizationRole?: string;
  organizationScopes?: string[];
  organizationSigningAuthority?: boolean;
  organizationEncryptionMode?: string;
  organizationKeyCustody?: string;
  organizationAuthMethod?: string;
  organizationSsoConnectionId?: string;
}) {
  if (!record.organizationId) return null;
  return {
    id: record.organizationId,
    name: record.organizationName,
    memberId: record.organizationMemberId,
    role: record.organizationRole,
    scopes: record.organizationScopes || [],
    signingAuthority: !!record.organizationSigningAuthority,
    encryptionMode: record.organizationEncryptionMode,
    keyCustody: record.organizationKeyCustody,
    authMethod: record.organizationAuthMethod,
    ssoConnectionId: record.organizationSsoConnectionId,
    e2eeKeyDelivery: "ave_identity_grants_only",
  };
}

export function workspaceOrganizationResponse(
  organization: typeof organizations.$inferSelect,
  member: typeof organizationIdentityMembers.$inferSelect,
  encryptionPolicy: ReturnType<typeof serializeEncryptionPolicy>
) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logoUrl: organization.logoUrl,
    role: member.role,
    scopes: scopesForRole(member.role as BusinessRole, member.scopes as string[] | null),
    signingAuthority: member.signingAuthority,
    ssoRequired: organization.ssoRequired,
    encryptionMode: encryptionPolicy.mode,
    keyCustody: keyCustodyForEncryptionMode(encryptionPolicy.mode),
  };
}

export async function resolveAccessTokenRecord(token: string): Promise<AccessTokenRecord | null> {
  const stored = await getAccessToken(token);
  if (stored) return stored;

  const jwtPayload = await verifyJwt(token, getResourceAudience());
  if (!jwtPayload) return null;

  return {
    userId: typeof jwtPayload.uid === "string" ? jwtPayload.uid : "",
    identityId: String(jwtPayload.sub || ""),
    appId: String(jwtPayload.cid || ""),
    scope: String(jwtPayload.scope || ""),
    expiresAt: typeof jwtPayload.exp === "number" ? jwtPayload.exp * 1000 : 0,
    redirectUri: "",
    organizationId: typeof jwtPayload.org_id === "string" ? jwtPayload.org_id : undefined,
    organizationName: typeof jwtPayload.org_name === "string" ? jwtPayload.org_name : undefined,
    organizationMemberId: typeof jwtPayload.org_member_id === "string" ? jwtPayload.org_member_id : undefined,
    organizationRole: typeof jwtPayload.org_role === "string" ? jwtPayload.org_role : undefined,
    organizationScopes: Array.isArray(jwtPayload.org_scopes) ? jwtPayload.org_scopes.filter((scope): scope is string => typeof scope === "string") : undefined,
    organizationSigningAuthority: typeof jwtPayload.org_signing_authority === "boolean" ? jwtPayload.org_signing_authority : undefined,
    organizationEncryptionMode: typeof jwtPayload.org_encryption_mode === "string" ? jwtPayload.org_encryption_mode : undefined,
    organizationKeyCustody: typeof jwtPayload.org_key_custody === "string" ? jwtPayload.org_key_custody : undefined,
    organizationAuthMethod: typeof jwtPayload.auth_method === "string" ? jwtPayload.auth_method : undefined,
    organizationSsoConnectionId: typeof jwtPayload.sso_connection_id === "string" ? jwtPayload.sso_connection_id : undefined,
  };
}

export async function resolveOauthAppForAccessRecord(record: Pick<AccessTokenRecord, "appId">) {
  const lookup = record.appId.startsWith("app_")
    ? eq(oauthApps.clientId, record.appId)
    : eq(oauthApps.id, record.appId);
  const [oauthApp] = await db.select().from(oauthApps).where(lookup).limit(1);
  return oauthApp ?? null;
}

export function keyCustodyForEncryptionMode(mode: string | undefined) {
  if (mode === "e2ee") return "identity_grants";
  if (mode === "enterprise_managed") return "customer_kms";
  return "ave_standard";
}

export function ensureFedCmRequest(c: any): Response | null {
  const destination = c.req.header("Sec-Fetch-Dest");
  if (destination !== "webidentity") {
    return c.json({ error: "invalid_request", error_description: "FedCM requests must include Sec-Fetch-Dest: webidentity" }, 400);
  }
  return null;
}

export function setLoginStatusHeader(c: any, status: "logged-in" | "logged-out") {
  c.header("Set-Login", status);
}

export async function resolveOauthAppForClient(clientId: string) {
  if (isQuickClient(clientId)) {
    return null;
  }

  const [app] = await db
    .select()
    .from(oauthApps)
    .where(eq(oauthApps.clientId, clientId))
    .limit(1);

  return app ?? null;
}

export async function issueAuthorizationCodeForApp(params: {
  userId: string;
  appId: string;
  identityId: string;
  redirectUri: string;
  scope: string;
  nonce?: string;
  encryptedAppKey?: string;
  appPublicKey?: string;
  encryptedAppPrivateKey?: string;
  appEncryptionMode?: string;
  organizationId?: string;
  organizationName?: string;
  organizationMemberId?: string;
  organizationRole?: string;
  organizationScopes?: string[];
  organizationSigningAuthority?: boolean;
  organizationEncryptionMode?: string;
  organizationKeyCustody?: string;
  organizationAuthMethod?: string;
  organizationSsoConnectionId?: string;
}) {
  const code = generateAuthCode();

  await setAuthorizationCode(code, {
    userId: params.userId,
    appId: params.appId,
    identityId: params.identityId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    expiresAt: Date.now() + 10 * 60 * 1000,
    encryptedAppKey: params.encryptedAppKey,
    appPublicKey: params.appPublicKey,
    encryptedAppPrivateKey: params.encryptedAppPrivateKey,
    appEncryptionMode: params.appEncryptionMode,
    nonce: params.nonce,
    organizationId: params.organizationId,
    organizationName: params.organizationName,
    organizationMemberId: params.organizationMemberId,
    organizationRole: params.organizationRole,
    organizationScopes: params.organizationScopes,
    organizationSigningAuthority: params.organizationSigningAuthority,
    organizationEncryptionMode: params.organizationEncryptionMode,
    organizationKeyCustody: params.organizationKeyCustody,
    organizationAuthMethod: params.organizationAuthMethod,
    organizationSsoConnectionId: params.organizationSsoConnectionId,
  });

  return code;
}

export async function buildTokenResponseFromAuthorizationCode(params: {
  authCode: {
    userId: string;
    identityId: string;
    scope: string;
    nonce?: string;
    encryptedAppKey?: string;
    organizationId?: string;
    organizationName?: string;
    organizationMemberId?: string;
    organizationRole?: string;
    organizationScopes?: string[];
    organizationSigningAuthority?: boolean;
    organizationEncryptionMode?: string;
    organizationKeyCustody?: string;
    organizationAuthMethod?: string;
    organizationSsoConnectionId?: string;
  };
  oauthApp: ReturnType<typeof buildQuickApp> | typeof oauthApps.$inferSelect;
  clientId: string;
  redirectUri: string;
  includeEncryptedAppKey?: boolean;
  issueRefreshToken?: boolean;
}) {
  const { authCode, oauthApp, clientId, redirectUri, includeEncryptedAppKey, issueRefreshToken = false } = params;

  const accessToken = generateAccessToken();
  const accessTokenTtl = oauthApp.accessTokenTtlSeconds || 3600;
  const refreshTokenTtl = oauthApp.refreshTokenTtlSeconds || 30 * 24 * 60 * 60;

  const accessTokenWrite = setAccessToken(accessToken, {
    userId: authCode.userId,
    identityId: authCode.identityId,
    appId: oauthApp.id,
    scope: authCode.scope,
    expiresAt: Date.now() + accessTokenTtl * 1000,
    redirectUri,
    organizationId: authCode.organizationId,
    organizationName: authCode.organizationName,
    organizationMemberId: authCode.organizationMemberId,
    organizationRole: authCode.organizationRole,
    organizationScopes: authCode.organizationScopes,
    organizationSigningAuthority: authCode.organizationSigningAuthority,
    organizationEncryptionMode: authCode.organizationEncryptionMode,
    organizationKeyCustody: authCode.organizationKeyCustody,
    organizationAuthMethod: authCode.organizationAuthMethod,
    organizationSsoConnectionId: authCode.organizationSsoConnectionId,
  });

  const identityLookup = db
    .select()
    .from(identities)
    .where(eq(identities.id, authCode.identityId))
    .limit(1);
  const [[identity]] = await Promise.all([identityLookup, accessTokenWrite]);

  const subject = authCode.identityId;
  const issuedAt = nowSeconds();
  const expiresAt = issuedAt + accessTokenTtl;

  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: accessTokenTtl,
    scope: authCode.scope,
    user: identity ? serializeIdentityForApp(identity) : null,
  };

  const jwtAccessTokenPromise = signJwt({
    iss: getIssuer(),
    sub: subject,
    aud: getResourceAudience(),
    exp: expiresAt,
    iat: issuedAt,
    scope: authCode.scope,
    cid: oauthApp.clientId,
    uid: hasScope(authCode.scope, "user_id") ? authCode.userId : undefined,
    ...(isQuickClient(clientId) ? { quick: true } : {}),
    ...organizationClaims(authCode),
  });

  const idTokenPromise = hasScope(authCode.scope, "openid")
    ? signJwt({
      iss: getIssuer(),
      sub: subject,
      aud: oauthApp.clientId,
      exp: expiresAt,
      iat: issuedAt,
      auth_time: issuedAt,
      azp: oauthApp.clientId,
      nonce: authCode.nonce,
      name: hasScope(authCode.scope, "profile") ? identity?.displayName : undefined,
      preferred_username: hasScope(authCode.scope, "profile") ? identity?.handle : undefined,
      email: hasScope(authCode.scope, "email") ? identity?.email : undefined,
      picture: hasScope(authCode.scope, "profile") ? identity?.avatarUrl : undefined,
      ...organizationClaims(authCode),
    })
    : Promise.resolve(null);

  const [jwtAccessToken, idToken] = await Promise.all([jwtAccessTokenPromise, idTokenPromise]);
  response.access_token_jwt = jwtAccessToken;

  if (hasScope(authCode.scope, "user_id")) {
    response.user_id = authCode.userId;
  }

  if (idToken) {
    response.id_token = idToken;
  }

  if (issueRefreshToken && hasScope(authCode.scope, "offline_access") && !isQuickClient(clientId)) {
    const refreshToken = generateRefreshToken();
    const refreshTokenId = randomUUID();
    await db.insert(oauthRefreshTokens).values({
      id: refreshTokenId,
      familyId: refreshTokenId,
      userId: authCode.userId,
      identityId: authCode.identityId,
      appId: oauthApp.id,
      tokenHash: hashToken(refreshToken),
      scope: authCode.scope,
      expiresAt: new Date(Date.now() + refreshTokenTtl * 1000),
      organizationId: authCode.organizationId,
      organizationMemberId: authCode.organizationMemberId,
      enterpriseSsoOrganizationId: authCode.organizationAuthMethod === "enterprise_sso" ? authCode.organizationId : undefined,
      enterpriseSsoConnectionId: authCode.organizationSsoConnectionId,
    });
    response.refresh_token = refreshToken;
  }

  if (authCode.organizationId) {
    response.organization = organizationResponse(authCode);
  }

  if (includeEncryptedAppKey && authCode.encryptedAppKey) {
    response.encryptedAppKey = authCode.encryptedAppKey;
  }

  return response;
}

// ============================================
// Quick Auth helpers — no app registration required.
// clientId format: "origin:<origin>"  e.g. "origin:https://example.com"
// Security is provided by PKCE; no client secret is needed or accepted.
// ============================================
