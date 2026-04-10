import {
  buildAuthorizeUrl,
  buildConnectorUrl,
  exchangeCode,
  exchangeFedCmAssertion,
  generateCodeChallenge,
  generateCodeVerifier,
  generateNonce,
  getApiBase,
  getIdentityPublicKey,
} from "./index.js";
import { isJwtVerificationSupported } from "./crypto-runtime.js";
import { verifyJwt } from "./jwt.js";
import type {
  AveIdTokenClaims,
  AveJwtClaims,
  FedCmTokenResponse,
  TokenResponse,
  WrappedIdentityPayload,
} from "./types.js";

export { fetchJwks, verifyJwt } from "./jwt.js";
export type {
  FedCmTokenResponse,
  IdentityKeyEnvelope,
  IdentityPublicKeyRecord,
  VerifyJwtOptions,
  WrappedIdentityPayload,
} from "./types.js";

interface FedCmIdentityCredential extends Credential {
  token?: string;
  configURL?: string;
}

interface FedCmOptions {
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
  state?: string;
  nonce?: string;
  mediation?: CredentialMediationRequirement;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payloadSegment] = token.split(".");
    if (!payloadSegment) return null;
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function toPlainArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

function toArrayBuffer(data: string | Uint8Array | ArrayBuffer): ArrayBuffer {
  if (typeof data === "string") {
    return toPlainArrayBuffer(new TextEncoder().encode(data));
  }

  if (data instanceof Uint8Array) {
    return toPlainArrayBuffer(data);
  }

  return data;
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(base64Url: string): string {
  const normalized = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return padded;
}

async function importIdentityPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    toPlainArrayBuffer(decodeBase64(publicKeyB64)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

async function deriveIdentitySharedKey(privateKey: CryptoKey, peerPublicKeyB64: string): Promise<CryptoKey> {
  const publicKey = await importIdentityPublicKey(peerPublicKeyB64);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function generateEphemeralKeyPair(): Promise<{
  publicKey: string;
  privateKey: CryptoKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  return {
    publicKey: encodeBase64(new Uint8Array(publicKey)),
    privateKey: keyPair.privateKey,
  };
}

export async function exportIdentityPrivateKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("pkcs8", privateKey);
  return encodeBase64(new Uint8Array(exported));
}

export async function importIdentityPrivateKey(privateKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    toPlainArrayBuffer(decodeBase64(privateKeyB64)),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"]
  );
}

export async function encryptPayloadForIdentity(
  payload: string | Uint8Array | ArrayBuffer,
  recipientPublicKey: string
): Promise<WrappedIdentityPayload> {
  const sender = await generateEphemeralKeyPair();
  const sharedKey = await deriveIdentitySharedKey(sender.privateKey, recipientPublicKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, toArrayBuffer(payload));
  const packed = new Uint8Array(iv.byteLength + encrypted.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(encrypted), iv.byteLength);

  return {
    encryptedPayload: encodeBase64(packed),
    senderPublicKey: sender.publicKey,
  };
}

export async function encryptPayloadForHandle(
  payload: string | Uint8Array | ArrayBuffer,
  params: { handle: string; issuer?: string }
): Promise<WrappedIdentityPayload> {
  const recipient = await getIdentityPublicKey({ issuer: params.issuer }, params.handle);
  return encryptPayloadForIdentity(payload, recipient.publicKey);
}

export async function decryptWrappedPayload(
  wrapped: WrappedIdentityPayload,
  recipientPrivateKey: CryptoKey
): Promise<ArrayBuffer> {
  const sharedKey = await deriveIdentitySharedKey(recipientPrivateKey, wrapped.senderPublicKey);
  const packed = decodeBase64(wrapped.encryptedPayload);
  const iv = packed.slice(0, 12);
  const ciphertext = packed.slice(12);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, sharedKey, ciphertext);
}

export function encodeWrappedPayloadParam(wrapped: WrappedIdentityPayload): string {
  const json = JSON.stringify(wrapped);
  const bytes = new TextEncoder().encode(json);
  return toBase64Url(encodeBase64(bytes));
}

export function decodeWrappedPayloadParam(value: string): WrappedIdentityPayload {
  const json = atob(fromBase64Url(value));
  const parsed = JSON.parse(json) as Partial<WrappedIdentityPayload>;
  if (!parsed.encryptedPayload || !parsed.senderPublicKey) {
    throw new Error("Invalid wrapped payload param");
  }
  return {
    encryptedPayload: parsed.encryptedPayload,
    senderPublicKey: parsed.senderPublicKey,
  };
}

// PKCE_STORAGE_KEY is the new canonical SDK storage entry.
// The individual keys are kept only for backwards compatibility with older
// integrations that still read the verifier/nonce directly from sessionStorage.
const PKCE_STORAGE_KEY = "ave_pkce";
const PKCE_VERIFIER_KEY = "ave_code_verifier";
const PKCE_NONCE_KEY = "ave_nonce";
const PKCE_STATE_KEY = "ave_state";
const PKCE_MAX_AGE_MS = 10 * 60 * 1000;

interface StoredPkceState {
  verifier: string;
  state: string;
  nonce: string;
  createdAt: number;
}

function storePkceState(value: StoredPkceState): void {
  sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(value));
  // Keep the legacy keys in sync so existing PKCE integrations that still read
  // them directly can migrate to finishPkceLogin() without breaking.
  sessionStorage.setItem(PKCE_VERIFIER_KEY, value.verifier);
  sessionStorage.setItem(PKCE_NONCE_KEY, value.nonce);
  sessionStorage.setItem(PKCE_STATE_KEY, value.state);
}

function clearPkceState(): void {
  sessionStorage.removeItem(PKCE_STORAGE_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(PKCE_NONCE_KEY);
  sessionStorage.removeItem(PKCE_STATE_KEY);
}

function readPkceState(): StoredPkceState {
  const rawState = sessionStorage.getItem(PKCE_STORAGE_KEY);
  if (!rawState) {
    throw new Error("[Ave] Missing PKCE verifier. Call startPkceLogin first.");
  }

  let pkce: StoredPkceState;
  try {
    pkce = JSON.parse(rawState) as StoredPkceState;
  } catch {
    clearPkceState();
    throw new Error("[Ave] PKCE verifier is corrupted.");
  }

  if (
    typeof pkce.verifier !== "string" ||
    typeof pkce.state !== "string" ||
    typeof pkce.nonce !== "string" ||
    typeof pkce.createdAt !== "number"
  ) {
    clearPkceState();
    throw new Error("[Ave] PKCE verifier is corrupted.");
  }

  if (Date.now() - pkce.createdAt > PKCE_MAX_AGE_MS) {
    clearPkceState();
    throw new Error("[Ave] PKCE verifier expired. Call startPkceLogin again.");
  }

  return pkce;
}

async function verifyReturnedTokens(params: {
  issuer?: string;
  clientId: string;
  expectedNonce: string;
  expectedSubject?: string;
  idToken?: string;
  accessTokenJwt?: string;
}): Promise<void> {
  if (!(await isJwtVerificationSupported())) {
    return;
  }

  if (params.idToken) {
    const idPayload = await verifyJwt<AveIdTokenClaims>(params.idToken, {
      issuer: params.issuer,
      audience: params.clientId,
      nonce: params.expectedNonce,
    });

    if (!idPayload) {
      throw new Error("[Ave] Invalid id_token — signature or claims validation failed.");
    }

    if (params.expectedSubject && idPayload.sub !== params.expectedSubject) {
      throw new Error("[Ave] id_token subject mismatch.");
    }
  }

  if (params.accessTokenJwt) {
    const accessPayload = await verifyJwt<AveJwtClaims>(params.accessTokenJwt, {
      issuer: params.issuer,
    });

    if (!accessPayload) {
      throw new Error("[Ave] Invalid access_token_jwt — signature or claims validation failed.");
    }

    if (params.expectedSubject && accessPayload.sub !== params.expectedSubject) {
      throw new Error("[Ave] access_token_jwt subject mismatch.");
    }
  }
}

export async function startPkceLogin(params: {
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
  state?: string;
  nonce?: string;
}): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const nonce = params.nonce ?? generateNonce();
  const state = params.state ?? generateNonce();

  storePkceState({
    verifier,
    nonce,
    state,
    createdAt: Date.now(),
  });

  const url = buildAuthorizeUrl(
    {
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      issuer: params.issuer,
    },
    {
      scope: (params.scope || "openid profile email").split(" ") as any,
      state,
      nonce,
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
    }
  );

  window.location.href = url;
}

export function supportsFedCm(): boolean {
  return typeof window !== "undefined"
    && typeof navigator !== "undefined"
    && !!navigator.credentials
    && typeof navigator.credentials.get === "function"
    && typeof window.isSecureContext === "boolean"
    && window.isSecureContext;
}

export async function signInWithFedCm(params: FedCmOptions): Promise<FedCmTokenResponse> {
  if (!supportsFedCm()) {
    throw new Error("[Ave] FedCM is not available in this browser.");
  }

  const state = params.state ?? generateNonce();
  const nonce = params.nonce ?? generateNonce();
  const configUrl = `${getApiBase(params.issuer)}/api/oauth/fedcm/config`;

  const credential = await navigator.credentials.get({
    identity: {
      context: "signin",
      providers: [
        {
          configURL: configUrl,
          clientId: params.clientId,
          nonce,
          fields: ["name", "email", "picture"],
          params: {
            scope: params.scope ?? "openid profile email",
            redirectUri: params.redirectUri,
            state,
            nonce,
          },
        },
      ],
    } as any,
    mediation: params.mediation ?? "optional",
  } as CredentialRequestOptions) as FedCmIdentityCredential | null;

  const assertion = credential?.token;
  if (!assertion) {
    throw new Error("[Ave] FedCM did not return an assertion.");
  }

  const assertionPayload = decodeJwtPayload(assertion);

  const response = await exchangeFedCmAssertion(
    {
      clientId: params.clientId,
      issuer: params.issuer,
    },
    { assertion },
  );

  if (typeof assertionPayload?.app_key === "string") {
    response.app_key = assertionPayload.app_key;
  }

  return response;
}

export async function signIn(params: FedCmOptions & { preferFedCm?: boolean }): Promise<FedCmTokenResponse | null> {
  if (params.preferFedCm !== false && supportsFedCm()) {
    return signInWithFedCm(params);
  }

  await startPkceLogin(params);
  return null;
}

/**
 * Complete the standard PKCE/OIDC callback.
 * Returns null when no authorization code is present in the URL.
 */
export async function finishPkceLogin(options: {
  clientId: string;
  redirectUri: string;
  issuer?: string;
  /** Override the callback URL to parse (defaults to window.location.href) */
  url?: string;
  /** Set to false to keep the code/state parameters in the current URL */
  cleanUrl?: boolean;
}): Promise<TokenResponse | null> {
  const callbackUrl = options.url ?? window.location.href;
  const parsed = new URL(callbackUrl);
  const code = parsed.searchParams.get("code");
  const state = parsed.searchParams.get("state");
  if (!code) return null;
  if (!state) {
    throw new Error("[Ave] Missing state parameter — cannot verify CSRF protection.");
  }

  const pkce = readPkceState();
  if (pkce.state !== state) {
    throw new Error("[Ave] State mismatch — possible CSRF attack.");
  }

  const token = await exchangeCode(
    {
      clientId: options.clientId,
      redirectUri: options.redirectUri,
      issuer: options.issuer,
    },
    {
      code,
      codeVerifier: pkce.verifier,
    },
  );

  clearPkceState();

  await verifyReturnedTokens({
    issuer: options.issuer,
    clientId: options.clientId,
    expectedNonce: pkce.nonce,
    accessTokenJwt: token.access_token_jwt,
    idToken: token.id_token,
  });

  if (options.cleanUrl !== false && typeof window !== "undefined" && typeof window.history !== "undefined") {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("code");
    cleanUrl.searchParams.delete("state");
    history.replaceState({}, "", cleanUrl.toString());
  }

  return token;
}

export async function startConnectorFlow(params: {
  clientId: string;
  redirectUri: string;
  resource: string;
  scope: string;
  mode?: "user_present" | "background";
  issuer?: string;
}): Promise<void> {
  const state = generateNonce();
  sessionStorage.setItem("ave_connector_state", state);

  const url = buildConnectorUrl(
    {
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      issuer: params.issuer,
    },
    {
      resource: params.resource,
      scope: params.scope,
      mode: params.mode || "user_present",
      state,
    }
  );

  window.location.href = url;
}

// ============================================
// Quick Ave — zero-registration auth
//
// The clientId is derived from the calling site's origin
// ("origin:https://example.com"), PKCE is the only required security
// mechanism, and no app registration is needed.
//
// Minimal usage:
//   // protected page
//   const user = getQuickIdentity();
//   if (!user) await startQuickSignIn();
//
//   // callback page (/ave/callback by default)
//   await handleQuickCallback();
//
// When you're ready to graduate to the full OIDC flow, replace these calls
// with startPkceLogin / exchangeCode from the regular SDK.
// ============================================

const QUICK_STORAGE_KEY = "ave_quick_identity";
const QUICK_PKCE_KEY = "ave_quick_pkce";
const QUICK_RETURN_TO_KEY = "ave_quick_return_to";
const QUICK_CALLBACK_PATH = "/ave/callback";
const QUICK_PKCE_MAX_AGE_MS = 10 * 60 * 1000;

export interface QuickIdentity {
  userId: string;
  handle?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  /**
   * JWT access token (`access_token_jwt`).
   * Suitable for prototypes and low-risk internal tooling — pass it as a Bearer
   * token to your own API. For production or security-sensitive deployments,
   * always verify server-side: check `iss`, `aud`, `exp`, and the JWT signature
   * against the JWKS endpoint (`https://aveid.net/.well-known/jwks.json`).
   * Upgrade to the standard OIDC flow for confidential or high-security use cases.
   */
  token: string;
  /**
   * OIDC id_token — pass this to Convex or any service that validates OIDC identity.
   * Only present when the `openid` scope was requested (the default).
   * The `aud` claim equals your site's Quick Ave clientId: `"origin:https://yourapp.com"`.
   */
  idToken?: string;
  expiresIn: number;
  receivedAt: number;
}

function deriveQuickClientId(redirectUri?: string): string {
  try {
    return "origin:" + new URL(redirectUri ?? window.location.href).origin;
  } catch {
    return "origin:" + window.location.origin;
  }
}

function defaultRedirectUri(): string {
  return new URL(QUICK_CALLBACK_PATH, window.location.origin).toString();
}

/**
 * Redirect the user to Ave to sign in.
 * Call this from any page that requires authentication.
 *
 * @param options.issuer      Override the Ave issuer (default: https://aveid.net)
 * @param options.scope       Space-separated scopes (default: "openid profile email")
 * @param options.redirectUri Callback URL on your site (default: <origin>/ave/callback)
 * @param options.returnTo    Where to send the user after sign-in (default: current URL)
 */
export async function startQuickSignIn(options?: {
  issuer?: string;
  scope?: string;
  redirectUri?: string;
  returnTo?: string;
}): Promise<void> {
  const issuer = options?.issuer ?? "https://aveid.net";
  const redirectUri = options?.redirectUri ?? defaultRedirectUri();

  // Remember where to send the user after the callback
  const returnTo =
    options?.returnTo ??
    window.location.pathname + window.location.search + window.location.hash;
  const callbackPathname = new URL(redirectUri, window.location.origin).pathname;
  try {
    const normalized = new URL(returnTo, window.location.origin);
    if (
      normalized.origin === window.location.origin &&
      normalized.pathname !== callbackPathname
    ) {
      sessionStorage.setItem(
        QUICK_RETURN_TO_KEY,
        normalized.pathname + normalized.search + normalized.hash,
      );
    }
  } catch { /* ignore */ }

  // Generate PKCE bundle
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const nonce = generateNonce();
  const state = generateNonce();

  sessionStorage.setItem(
    QUICK_PKCE_KEY,
    JSON.stringify({ verifier, state, nonce, createdAt: Date.now() }),
  );

  const url = new URL(`${issuer}/signin`);
  url.searchParams.set("client_id", deriveQuickClientId(redirectUri));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", options?.scope ?? "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  window.location.assign(url.toString());
}

/**
 * Exchange the authorization code after being redirected back from Ave.
 * Returns null when no code is present in the URL (safe to call on every page load).
 */
export async function finishQuickSignIn(options?: {
  issuer?: string;
  redirectUri?: string;
  /** Override the callback URL to parse (defaults to window.location.href) */
  url?: string;
}): Promise<QuickIdentity | null> {
  const callbackUrl = options?.url ?? window.location.href;
  const parsed = new URL(callbackUrl);
  const code = parsed.searchParams.get("code");
  const state = parsed.searchParams.get("state");
  if (!code) return null;
  if (!state) {
    throw new Error("[Quick Ave] Missing state parameter — cannot verify CSRF protection.");
  }

  const rawPkce = sessionStorage.getItem(QUICK_PKCE_KEY);
  if (!rawPkce) {
    throw new Error("[Quick Ave] Missing PKCE verifier. Call startQuickSignIn first.");
  }

  let pkce: { verifier: string; state: string; nonce: string; createdAt: number };
  try {
    pkce = JSON.parse(rawPkce);
  } catch {
    throw new Error("[Quick Ave] PKCE verifier is corrupted.");
  }

  if (Date.now() - pkce.createdAt > QUICK_PKCE_MAX_AGE_MS) {
    sessionStorage.removeItem(QUICK_PKCE_KEY);
    throw new Error("[Quick Ave] PKCE verifier expired. Call startQuickSignIn again.");
  }

  if (pkce.state !== state) {
    throw new Error("[Quick Ave] State mismatch — possible CSRF attack.");
  }

  const redirectUri = options?.redirectUri ?? defaultRedirectUri();
  const apiBase = getApiBase(options?.issuer);

  const response = await fetch(`${apiBase}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "authorization_code",
      code,
      redirectUri,
      clientId: deriveQuickClientId(redirectUri),
      codeVerifier: pkce.verifier,
    }),
  });

  if (!response.ok) {
    // Only remove the PKCE entry if the server explicitly rejects the code (4xx),
    // so transient network/5xx errors don't force the user to restart sign-in.
    if (response.status >= 400 && response.status < 500) {
      sessionStorage.removeItem(QUICK_PKCE_KEY);
    }
    // response.json() may fail for non-JSON error bodies (e.g. HTML gateway errors)
    const data = await response.json().catch(() => ({})) as { error?: string; error_description?: string };
    const error = data.error;
    const errorDescription = data.error_description;
    let message: string;
    if (error && errorDescription) {
      message = `${error}: ${errorDescription}`;
    } else if (errorDescription) {
      message = errorDescription;
    } else if (error) {
      message = error;
    } else {
      message = "[Quick Ave] Failed to exchange token";
    }
    throw new Error(message);
  }

  // Exchange succeeded — PKCE entry is no longer needed
  sessionStorage.removeItem(QUICK_PKCE_KEY);

  const token = (await response.json()) as {
    access_token: string;
    access_token_jwt?: string;
    id_token?: string;
    expires_in: number;
    user?: {
      id: string;
      handle: string;
      displayName: string;
      email?: string;
      avatarUrl?: string;
    } | null;
  };

  if (!token.user?.id) {
    throw new Error("[Quick Ave] Token exchange succeeded but no user identity was returned.");
  }

  await verifyReturnedTokens({
    issuer: options?.issuer,
    clientId: deriveQuickClientId(redirectUri),
    expectedNonce: pkce.nonce,
    expectedSubject: token.user.id,
    accessTokenJwt: token.access_token_jwt,
    idToken: token.id_token,
  });

  const identity: QuickIdentity = {
    userId: token.user.id,
    handle: token.user.handle,
    displayName: token.user.displayName,
    email: token.user.email,
    avatarUrl: token.user.avatarUrl,
    token: token.access_token_jwt ?? token.access_token,
    idToken: token.id_token,
    expiresIn: token.expires_in,
    receivedAt: Date.now(),
  };

  localStorage.setItem(QUICK_STORAGE_KEY, JSON.stringify(identity));

  // Remove the code and state from the URL without triggering a reload
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("code");
  cleanUrl.searchParams.delete("state");
  history.replaceState({}, "", cleanUrl.toString());

  return identity;
}

/**
 * Call this on your callback page (default: /ave/callback).
 * It exchanges the code and then redirects the user to where they came from.
 *
 * @example
 * // In your /ave/callback page component:
 * onMount(() => handleQuickCallback());
 */
export async function handleQuickCallback(options?: {
  issuer?: string;
  /** Must match the redirectUri passed to startQuickSignIn (default: <origin>/ave/callback) */
  redirectUri?: string;
  /** Fallback redirect when no return-to is stored (default: "/") */
  fallbackPath?: string;
}): Promise<QuickIdentity | null> {
  const parsed = new URL(window.location.href);
  if (!parsed.searchParams.get("code")) return null;

  const identity = await finishQuickSignIn(options);
  if (!identity) return null;

  const returnTo =
    sessionStorage.getItem(QUICK_RETURN_TO_KEY) ?? options?.fallbackPath ?? "/";
  sessionStorage.removeItem(QUICK_RETURN_TO_KEY);
  window.location.replace(returnTo);

  return identity;
}

/**
 * Return the stored Quick Ave identity, or null if not signed in / token expired.
 */
export function getQuickIdentity(storageKey?: string): QuickIdentity | null {
  const key = storageKey ?? QUICK_STORAGE_KEY;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as QuickIdentity;
    if (!parsed?.userId) return null;
    // Treat locally-expired tokens as absent
    if (parsed.receivedAt && parsed.expiresIn) {
      if (Date.now() > parsed.receivedAt + parsed.expiresIn * 1000) {
        localStorage.removeItem(key);
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clear the stored Quick Ave identity (sign out).
 */
export function clearQuickIdentity(storageKey?: string): void {
  localStorage.removeItem(storageKey ?? QUICK_STORAGE_KEY);
}

/**
 * Check whether the stored token is still valid against the Ave server.
 * Returns { status: "active" } when valid, { status: "login_required" } otherwise.
 */
export async function checkQuickSession(options?: {
  issuer?: string;
  storageKey?: string;
  /** Supply a token directly instead of reading from storage */
  token?: string;
}): Promise<{
  status: "active" | "login_required" | "unsupported";
  reason?: string;
}> {
  const identity = getQuickIdentity(options?.storageKey);
  const token = options?.token ?? identity?.token;

  if (!token) {
    return { status: "login_required", reason: "no_token" };
  }

  const apiBase = getApiBase(options?.issuer);
  const response = await fetch(`${apiBase}/api/oauth/session/check`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 404 || response.status === 501) {
    return { status: "unsupported" };
  }

  if (response.ok) {
    return { status: "active" };
  }

  if (response.status === 401) {
    const data = (await response.json().catch(() => ({}))) as {
      reason?: string;
    };
    return { status: "login_required", reason: data.reason ?? "invalid_token" };
  }

  throw new Error(`[Quick Ave] Session check failed (${response.status})`);
}

/**
 * Start a background loop that periodically checks session validity.
 * When the session expires the onLoginRequired callback fires and the monitor stops.
 *
 * @returns An object with a stop() method.
 */
export function startQuickSessionMonitor(options?: {
  issuer?: string;
  storageKey?: string;
  /** Check interval in ms (default: 60 000) */
  intervalMs?: number;
  onLoginRequired?: (result: { reason?: string }) => void;
  onError?: (error: Error) => void;
}): { stop: () => void } {
  const checkIntervalMs = Math.max(1000, options?.intervalMs ?? 60_000);
  let stopped = false;
  let inFlight = false;

  async function runCheck() {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      const result = await checkQuickSession(options);
      if (result.status === "login_required") {
        options?.onLoginRequired?.(result);
        stop();
      }
    } catch (error) {
      options?.onError?.(error as Error);
    } finally {
      inFlight = false;
    }
  }

  const timer = setInterval(runCheck, checkIntervalMs);
  runCheck(); // immediate first check

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
  }

  return { stop };
}
