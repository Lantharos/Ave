export type Scope =
  | "openid"
  | "profile"
  | "email"
  | "offline_access"
  | "user_id"
  | "e2ee:symmetric"
  | "e2ee:asymmetric"
  | "e2ee:reset"
  | "e2ee:pqc:kyber"
  | "e2ee:pqc:dilithium";

import { joinOAuthScopes } from "./oauth/oauth-scopes.js";
import { formatOAuthPrompt, type OAuthPrompt } from "./oauth/oauth-prompt.js";
export { joinOAuthScopes, normalizeScopeToken, parseOAuthScopes } from "./oauth/oauth-scopes.js";
export {
  formatOAuthPrompt,
  OAUTH_PROMPT_VALUES,
  parseOAuthPrompt,
  requiresAuthorizeInteractionPrompt,
  wantsAccountPickerPrompt,
} from "./oauth/oauth-prompt.js";
export type { OAuthPrompt } from "./oauth/oauth-prompt.js";
export { getApiBase } from "./oauth/api-base.js";

export {
  AveSession,
  snapshotFromTokenResponse,
} from "./session/session.js";
export type {
  AveSessionOptions,
  AveSessionSnapshot,
  AveSessionStatus,
  AveSessionStorage,
} from "./session/session.js";
export {
  createLocalStorageAdapter,
  createMemoryStorage,
  createSecureStoreAdapter,
} from "./session/session-storage.js";
export type { AsyncSecureStoreLike } from "./session/session-storage.js";

export {
  extractAppKeyFromUrl,
  extractAppKeyOldFromUrl,
  extractAppPublicKeyFromUrl,
  extractAppPublicKeyOldFromUrl,
  extractAppPrivateKeyFromUrl,
  extractAppPrivateKeyOldFromUrl,
  extractAppKeyResetFromUrl,
  mergeAppKeyFromUrl,
  mergeAppEncryptionFromUrl,
  normalizeAppKeyBase64,
  stripOAuthQueryParamsFromUrlString,
  stripSensitiveFragmentParams,
  stripSensitiveHashFromUrlString,
} from "./crypto/app-key.js";

export {
  E2EE_SCOPES,
  E2EE_RESET_SCOPE,
  decryptFromAppSender,
  encryptForAppHandle,
  encryptForAppUser,
  importAppPrivateKey,
  lookupAppPublicKeyByHandle,
  lookupAppUserByPublicKey,
} from "./crypto/app-encryption.js";
export type { AppEncryptedPayload, AppEncryptionUserRecord } from "./crypto/app-encryption.js";
export { AppEncryptionLookupError } from "./crypto/app-encryption.js";

export { configureCryptoRuntime, createExpoCryptoRuntime, isJwtVerificationSupported } from "./crypto/crypto-runtime.js";
export type { AveCryptoRuntime } from "./crypto/crypto-runtime.js";
export { fetchJwks, verifyJwt } from "./crypto/jwt.js";
export type {
  AveIdTokenClaims,
  AveJwtClaims,
  FedCmTokenResponse,
  IdentityKeyEnvelope,
  IdentityPublicKeyRecord,
  JwkKey,
  JwksResponse,
  JwtHeader,
  JwtPayload,
  OidcConfiguration,
  VerifyJwtOptions,
} from "./types.js";
import { getApiBase } from "./oauth/api-base.js";
import { refreshAccessToken } from "./oauth/oauth-token.js";
import type { AveConfig } from "./types.js";
import { digestSha256, fillRandomValues } from "./crypto/crypto-runtime.js";

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  fillRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  return base64UrlEncode(await digestSha256(data));
}

export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  fillRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, 32);
}

export function buildAuthorizeUrl(config: AveConfig, params: {
  scope?: string[];
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256" | "plain";
  prompt?: OAuthPrompt | OAuthPrompt[] | string;
  extraParams?: Record<string, string>;
} = {}): string {
  const issuer = config.issuer || "https://aveid.net";
  const search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: joinOAuthScopes(params.scope || ["openid", "profile", "email"]),
    state: params.state || "",
    nonce: params.nonce || "",
    ...params.extraParams,
  });

  if (params.prompt) {
    search.set("prompt", formatOAuthPrompt(params.prompt));
  }

  if (params.codeChallenge) {
    search.set("code_challenge", params.codeChallenge);
    search.set("code_challenge_method", params.codeChallengeMethod || "S256");
  }

  return `${issuer}/signin?${search.toString()}`;
}

export function buildSwitchAccountUrl(
  config: AveConfig,
  params: Omit<Parameters<typeof buildAuthorizeUrl>[1], "prompt"> & {
    prompt?: OAuthPrompt | OAuthPrompt[] | string;
  } = {},
): string {
  return buildAuthorizeUrl(config, {
    ...params,
    prompt: params.prompt ?? "select_account",
  });
}

export function buildConnectorUrl(config: AveConfig, params: {
  state?: string;
  resource: string;
  scope: string;
  mode?: "user_present" | "background";
  extraParams?: Record<string, string>;
}): string {
  const issuer = config.issuer || "https://aveid.net";
  const search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    resource: params.resource,
    scope: params.scope,
    mode: params.mode || "user_present",
    state: params.state || "",
    ...params.extraParams,
  });

  return `${issuer}/connect?${search.toString()}`;
}

export async function exchangeCode(config: AveConfig, payload: {
  code: string;
  codeVerifier?: string;
}): Promise<import("./types.js").TokenResponse> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetch(`${apiBase}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "authorization_code",
      code: payload.code,
      redirectUri: config.redirectUri,
      clientId: config.clientId,
      codeVerifier: payload.codeVerifier,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to exchange token");
  }

  return response.json();
}

export async function refreshToken(config: AveConfig, payload: { refreshToken: string }): Promise<import("./types.js").TokenResponse> {
  return refreshAccessToken(config, payload);
}

export async function exchangeFedCmAssertion(
  config: Pick<AveConfig, "clientId" | "issuer">,
  payload: { assertion: string }
): Promise<import("./types.js").FedCmTokenResponse> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetch(`${apiBase}/api/oauth/fedcm/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assertion: payload.assertion,
      clientId: config.clientId,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error_description || data.error || "Failed to exchange FedCM assertion");
  }

  return response.json();
}

export async function exchangeDelegatedToken(
  config: AveConfig,
  payload: {
    subjectToken: string;
    requestedResource: string;
    requestedScope: string;
    actor?: Record<string, unknown>;
    clientSecret?: string;
  }
): Promise<import("./types.js").DelegationTokenResponse> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetch(`${apiBase}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
      subjectToken: payload.subjectToken,
      requestedResource: payload.requestedResource,
      requestedScope: payload.requestedScope,
      clientId: config.clientId,
      clientSecret: payload.clientSecret,
      actor: payload.actor,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to exchange delegated token");
  }

  return response.json();
}

export async function listDelegations(
  config: { issuer?: string },
  sessionToken: string
): Promise<import("./types.js").DelegationGrant[]> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetch(`${apiBase}/api/oauth/delegations`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to list delegations");
  }

  const payload = await response.json();
  return payload.delegations || [];
}

export async function revokeDelegation(
  config: { issuer?: string },
  sessionToken: string,
  delegationId: string
): Promise<void> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetch(`${apiBase}/api/oauth/delegations/${encodeURIComponent(delegationId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to revoke delegation");
  }
}

export async function fetchUserInfo(config: AveConfig, accessToken: string): Promise<import("./types.js").UserInfo> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetch(`${apiBase}/api/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to fetch user info");
  }

  return response.json();
}


export async function getIdentityPublicKey(
  config: { issuer?: string },
  handle: string
): Promise<import("./types.js").IdentityPublicKeyRecord> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetch(`${apiBase}/api/signing/public-key/${encodeURIComponent(handle)}`);

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to get identity public key");
  }

  return response.json();
}

export async function getIdentityKey(
  config: { issuer?: string },
  sessionToken: string,
  identityId: string
): Promise<import("./types.js").IdentityKeyEnvelope> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetch(`${apiBase}/api/signing/keys/${encodeURIComponent(identityId)}`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to get identity key envelope");
  }

  return response.json();
}

function base64UrlEncode(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i] ?? 0;
    const byte2 = bytes[i + 1] ?? 0;
    const byte3 = bytes[i + 2] ?? 0;

    const chunk = (byte1 << 16) | (byte2 << 8) | byte3;

    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(chunk >> 6) & 63] : "=";
    output += i + 2 < bytes.length ? alphabet[chunk & 63] : "=";
  }

  return output
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export { createSignatureRequest, getSignatureStatus, getPublicKey, verifySignature, buildSigningUrl, openSigningPopup } from "./signing.js";
export type { SigningConfig } from "./signing.js";
