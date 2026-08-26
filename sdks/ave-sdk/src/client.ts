import { mergeAppEncryptionFromUrl, stripSensitiveFragmentParams } from "./app-key.js";
import {
  buildAuthorizeUrl,
  buildConnectorUrl,
  exchangeCode,
  exchangeFedCmAssertion,
  formatOAuthPrompt,
  generateCodeChallenge,
  generateCodeVerifier,
  generateNonce,
  getApiBase,
  type OAuthPrompt,
} from "./index.js";
import { verifyReturnedTokens } from "./client/token-validation.js";
import type { AveSession } from "./session.js";
import type {
  FedCmTokenResponse,
  TokenResponse,
} from "./types.js";

export {
  extractAppKeyFromUrl,
  extractAppPublicKeyFromUrl,
  extractAppPrivateKeyFromUrl,
  mergeAppKeyFromUrl,
  mergeAppEncryptionFromUrl,
  normalizeAppKeyBase64,
  stripSensitiveFragmentParams,
} from "./app-key.js";
export { fetchJwks, verifyJwt } from "./jwt.js";
export {
  createAveWorkspaceOrganization,
  getAveWorkspaceContext,
  getAveWorkspaceContextFromUserInfo,
  hasAveWorkspaceRole,
  hasAveWorkspaceScope,
  listAveWorkspaceOrganizations,
  requireAveWorkspaceContext,
} from "./workspace.js";
export type {
  FedCmTokenResponse,
  IdentityKeyEnvelope,
  IdentityPublicKeyRecord,
  VerifyJwtOptions,
} from "./types.js";
export type {
  AveWorkspaceAuthMethod,
  AveWorkspaceContext,
  AveWorkspaceEncryptionMode,
  AveWorkspaceKeyCustody,
  AveWorkspaceOrganization,
  AveWorkspaceRole,
  AveWorkspaceScope,
} from "./workspace.js";

interface FedCmIdentityCredential extends Credential {
  token?: string;
  configURL?: string;
}

interface FedCmCredentialRequestOptions extends CredentialRequestOptions {
  identity: {
    context: "signin";
    providers: Array<{
      configURL: string;
      clientId: string;
      nonce: string;
      fields: string[];
      params: Record<string, string>;
    }>;
  };
}

interface FedCmOptions {
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
  state?: string;
  nonce?: string;
  prompt?: OAuthPrompt | OAuthPrompt[] | string;
  mediation?: CredentialMediationRequirement;
}

interface SignInOptions extends FedCmOptions {
  organizationId?: string;
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


export async function startPkceLogin(params: {
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
  state?: string;
  nonce?: string;
  organizationId?: string;
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
      organizationId: params.organizationId,
      prompt: params.prompt,
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

  const credentialOptions: FedCmCredentialRequestOptions = {
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
            ...(params.prompt ? { prompt: formatOAuthPrompt(params.prompt) } : {}),
          },
        },
      ],
    },
    mediation: params.mediation ?? "optional",
  };
  const credential = await navigator.credentials.get(credentialOptions) as FedCmIdentityCredential | null;

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

  const merged = { ...response } as FedCmTokenResponse;
  if (typeof assertionPayload?.app_key === "string") {
    merged.app_key = assertionPayload.app_key;
  }
  if (typeof assertionPayload?.app_key_old === "string") {
    merged.app_key_old = assertionPayload.app_key_old;
  }
  if (typeof assertionPayload?.app_public_key === "string") {
    merged.app_public_key = assertionPayload.app_public_key;
  }
  if (typeof assertionPayload?.app_public_key_old === "string") {
    merged.app_public_key_old = assertionPayload.app_public_key_old;
  }
  if (typeof assertionPayload?.app_private_key === "string") {
    merged.app_private_key = assertionPayload.app_private_key;
  }
  if (typeof assertionPayload?.app_private_key_old === "string") {
    merged.app_private_key_old = assertionPayload.app_private_key_old;
  }
  if (assertionPayload?.app_key_reset === true) {
    merged.app_key_reset = true;
  }

  return merged;
}

export async function signIn(params: SignInOptions & { preferFedCm?: boolean }): Promise<FedCmTokenResponse | null> {
  if (!params.organizationId && params.preferFedCm !== false && supportsFedCm()) {
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


export {
  checkQuickSession,
  clearQuickIdentity,
  finishQuickSignIn,
  getQuickIdentity,
  handleQuickCallback,
  startQuickSessionMonitor,
  startQuickSignIn,
} from "./client/quick.js";
export type { QuickIdentity } from "./client/quick.js";
