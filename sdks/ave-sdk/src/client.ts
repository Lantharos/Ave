import { mergeAppEncryptionFromUrl, stripSensitiveFragmentParams } from "./crypto/app-key.js";
import {
  buildAuthorizeUrl,
  exchangeCode,
  generateCodeChallenge,
  generateCodeVerifier,
  generateNonce,
  type OAuthPrompt,
} from "./index.js";
import { verifyReturnedTokens } from "./client/token-validation.js";
import type { AveSession } from "./session/session.js";
import type { TokenResponse } from "./types.js";

export {
  extractAppKeyFromUrl,
  extractAppPublicKeyFromUrl,
  extractAppPrivateKeyFromUrl,
  mergeAppKeyFromUrl,
  mergeAppEncryptionFromUrl,
  normalizeAppKeyBase64,
  stripSensitiveFragmentParams,
} from "./crypto/app-key.js";
export { fetchJwks, verifyJwt } from "./crypto/jwt.js";
export type { VerifyJwtOptions } from "./types.js";

const PKCE_STORAGE_KEY = "ave_pkce";
const PKCE_MAX_AGE_MS = 10 * 60 * 1000;

interface StoredPkceState {
  verifier: string;
  state: string;
  nonce: string;
  createdAt: number;
}

function storePkceState(value: StoredPkceState): void {
  sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(value));
}

function clearPkceState(): void {
  sessionStorage.removeItem(PKCE_STORAGE_KEY);
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


export async function startPkceLogin(params: {
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
  state?: string;
  nonce?: string;
  prompt?: OAuthPrompt | OAuthPrompt[] | string;
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
      scope: (params.scope || "openid profile email").split(" "),
      state,
      nonce,
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
      prompt: params.prompt,
    }
  );

  window.location.href = url;
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

  let token = await exchangeCode(
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

  token = mergeAppEncryptionFromUrl(callbackUrl, token);

  clearPkceState();

  await verifyReturnedTokens({
    issuer: options.issuer,
    clientId: options.clientId,
    expectedNonce: pkce.nonce,
    accessTokenJwt: token.access_token_jwt,
    idToken: token.id_token,
  });

  if (typeof window !== "undefined" && typeof window.history !== "undefined") {
    stripSensitiveFragmentParams();
    if (options.cleanUrl !== false) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("code");
      cleanUrl.searchParams.delete("state");
      history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    }
  }

  return token;
}

/**
 * `finishPkceLogin` + `session.setTokensFromResponse` — persists OAuth tokens and optional **`app_key`** from the hash.
 */
export async function completeOAuthCallback(
  session: AveSession,
  options: Parameters<typeof finishPkceLogin>[0]
): Promise<TokenResponse | null> {
  const token = await finishPkceLogin(options);
  if (!token) return null;
  await session.setTokensFromResponse(token);
  return token;
}
