import { buildAuthorizeUrl, buildConnectorUrl, generateCodeChallenge, generateCodeVerifier, generateNonce, getApiBase } from "./index";

export async function startPkceLogin(params: {
  clientId: string;
  redirectUri: string;
  scope?: string;
  issuer?: string;
}): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const nonce = generateNonce();

  sessionStorage.setItem("ave_code_verifier", verifier);
  sessionStorage.setItem("ave_nonce", nonce);

  const url = buildAuthorizeUrl(
    {
      clientId: params.clientId,
      redirectUri: params.redirectUri,
      issuer: params.issuer,
    },
    {
      scope: (params.scope || "openid profile email").split(" ") as any,
      nonce,
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
    }
  );

  window.location.href = url;
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
// Mirrors the shoo.dev pattern: the clientId is derived from the calling
// site's origin ("origin:https://example.com"), PKCE is the only required
// security mechanism, and no app registration is needed.
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
  /** JWT access token — use as Bearer token for your own API */
  token: string;
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
  try {
    const normalized = new URL(returnTo, window.location.origin);
    if (
      normalized.origin === window.location.origin &&
      normalized.pathname !== QUICK_CALLBACK_PATH
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
  if (!code || !state) return null;

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

  sessionStorage.removeItem(QUICK_PKCE_KEY);

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error ?? "[Quick Ave] Failed to exchange token");
  }

  const token = (await response.json()) as {
    access_token: string;
    access_token_jwt?: string;
    expires_in: number;
    user?: {
      id: string;
      handle: string;
      displayName: string;
      email?: string;
      avatarUrl?: string;
    };
  };

  const identity: QuickIdentity = {
    userId: token.user?.id ?? "",
    handle: token.user?.handle,
    displayName: token.user?.displayName,
    email: token.user?.email,
    avatarUrl: token.user?.avatarUrl,
    token: token.access_token_jwt ?? token.access_token,
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
