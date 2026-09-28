import { randomUUID, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db, oauthApps, oauthRefreshTokens } from "../../db";
import { hashSessionToken } from "../../lib/identity/crypto";
import { normalizeScopeToken, parseOAuthScopes } from "../../lib/oauth/oauth-scopes";
import { getAccessToken, type AccessTokenRecord } from "../../lib/oauth/oauth-store";
import { getResourceAudience, verifyJwt } from "../../lib/oauth/oidc";
import { normalizeRedirectUri } from "../../lib/oauth/redirect-uri";

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
  };
}

export function hasScope(scope: string, requested: string): boolean {
  return parseScopes(scope).includes(normalizeScopeToken(requested));
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

