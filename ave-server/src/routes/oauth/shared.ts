import { randomUUID, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db, oauthApps, oauthRefreshTokens, organizationIdentityMembers, organizations } from "../../db";
import { scopesForRole, type BusinessRole } from "../../lib/business";
import { serializeEncryptionPolicy } from "../../lib/business-encryption";
import { hashSessionToken } from "../../lib/crypto";
import { normalizeScopeToken, parseOAuthScopes } from "../../lib/oauth-scopes";
import { getAccessToken, type AccessTokenRecord } from "../../lib/oauth-store";
import { getResourceAudience, verifyJwt } from "../../lib/oidc";
import { normalizeRedirectUri } from "../../lib/redirect-uri";
import { isQuickClient } from "./quick-client";

export { buildQuickApp,getQuickOrigin,isQuickClient } from "./quick-client";

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
  if (token.split(".").length !== 3) {
    return getAccessToken(token);
  }

  const jwtPayload = await verifyJwt(token, getResourceAudience());
  if (!jwtPayload) return null;

  if (typeof jwtPayload.jti !== "string") return null;
  return getAccessToken(jwtPayload.jti);
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
