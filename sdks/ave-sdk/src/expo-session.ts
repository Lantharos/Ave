import { configureCryptoRuntime, createExpoCryptoRuntime, exchangeCode } from "./index.js";
import { mergeAppKeyFromUrl, stripOAuthQueryParamsFromUrlString, stripSensitiveHashFromUrlString } from "./app-key.js";
import { createSecureStoreAdapter } from "./session-storage.js";
import type { AveSession } from "./session.js";
import type { AveConfig, TokenResponse } from "./types.js";

export { AveSession } from "./session.js";
export type { AveSessionSnapshot, AveSessionOptions, AveSessionStatus } from "./session.js";

export { configureCryptoRuntime, createExpoCryptoRuntime } from "./index.js";
export { createSecureStoreAdapter } from "./session-storage.js";
export { onExpoAppForegroundRefresh } from "./expo-lifecycle.js";
export { wireAveSessionToConvex } from "./convex.js";

/**
 * Call once at app startup **before** PKCE (`generateCodeChallenge` / `exchangeCode`).
 * Expo native has no Web Crypto for SHA-256 — **`expo-crypto`** supplies it.
 *
 * @example
 * ```ts
 * import * as ExpoCrypto from "expo-crypto";
 * import { configureAveSdkForExpo } from "@ave-id/sdk/expo-session";
 * configureAveSdkForExpo(ExpoCrypto);
 * ```
 */
export function configureAveSdkForExpo(expoCrypto: Parameters<typeof createExpoCryptoRuntime>[0]): void {
  configureCryptoRuntime(createExpoCryptoRuntime(expoCrypto));
}

export interface ExpoOAuthRedirectParts {
  code: string | null;
  state: string | null;
  /** Full string for `mergeAppKeyFromUrl` when E2EE returns `#app_key=` on web or in universal links */
  urlForAppKeyMerge: string;
}

/**
 * Parse `code` / `state` from an AuthSession redirect URL or `Linking` event URL.
 */
export function parseExpoOAuthRedirectUrl(url: string): ExpoOAuthRedirectParts {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { code: null, state: null, urlForAppKeyMerge: url };
  }
  const code = parsed.searchParams.get("code");
  const state = parsed.searchParams.get("state");
  return { code, state, urlForAppKeyMerge: url };
}

/**
 * Exchange authorization code, merge `#app_key` when present, persist on **`AveSession`**.
 *
 * - **`redirectUrlWithFragment`**: pass the **full** redirect URL (e.g. from AuthSession `params.url` or `Linking`) so **`app_key`** in the hash is merged for E2EE.
 * - Set **`AveSession`** with **`crossTabSync: false`** on React Native (no `BroadcastChannel`).
 *
 * Client-side JWT verification is skipped when `expo-crypto` only backs digest/random — Convex or your API should validate **`id_token`**.
 */
export async function completeExpoOAuthCallback(
  session: AveSession,
  oauth: AveConfig,
  params: {
    code: string;
    codeVerifier: string;
    redirectUrlWithFragment?: string;
  }
): Promise<TokenResponse> {
  let tr = await exchangeCode(oauth, {
    code: params.code,
    codeVerifier: params.codeVerifier,
  });

  const mergeSource = params.redirectUrlWithFragment;
  if (mergeSource) {
    tr = mergeAppKeyFromUrl(mergeSource, tr);
  }

  await session.setTokensFromResponse(tr);
  return tr;
}

/**
 * Returns a display-safe redirect URL string: OAuth query params and sensitive hash keys removed.
 * Does not mutate the system browser — use for logging or showing a "connected" screen.
 */
export function redactExpoOAuthRedirectUrl(url: string): string {
  let s = stripOAuthQueryParamsFromUrlString(url);
  s = stripSensitiveHashFromUrlString(s);
  return s;
}
