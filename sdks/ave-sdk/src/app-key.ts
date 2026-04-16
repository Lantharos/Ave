import type { TokenResponse } from "./types.js";

/**
 * `URLSearchParams` treats `+` as space — normalize before base64 decode.
 */
export function normalizeAppKeyBase64(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  const fixed = raw.replace(/ /g, "+");
  return fixed;
}

/**
 * Read `app_key` from a URL hash (e.g. `#app_key=...`).
 */
export function extractAppKeyFromUrl(url: string | URL): string | null {
  try {
    const u = typeof url === "string" ? new URL(url) : url;
    const hash = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
    const params = new URLSearchParams(hash);
    return normalizeAppKeyBase64(params.get("app_key"));
  } catch {
    return null;
  }
}

/**
 * Merge fragment app key onto the token response (does not mutate input).
 */
export function mergeAppKeyFromUrl(url: string | URL, tr: TokenResponse): TokenResponse {
  const fromFragment = extractAppKeyFromUrl(url);
  if (!fromFragment) return tr;
  return { ...tr, app_key: fromFragment };
}

const HASH_SECRET_KEYS = ["app_key", "unwrapped_secret", "unwrappedSecretB64"];

/**
 * Remove sensitive fragment parameters from the current URL (after reading them).
 * Safe to call when no hash is present.
 */
export function stripSensitiveFragmentParams(url?: string): void {
  if (typeof window === "undefined" || typeof window.history === "undefined") return;
  const href = url ?? window.location.href;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return;
  }
  if (!u.hash || u.hash.length <= 1) return;
  const params = new URLSearchParams(u.hash.slice(1));
  let changed = false;
  for (const k of HASH_SECRET_KEYS) {
    if (params.has(k)) {
      params.delete(k);
      changed = true;
    }
  }
  if (!changed) return;
  const rest = params.toString();
  const newUrl = u.pathname + u.search + (rest ? `#${rest}` : "");
  window.history.replaceState({}, "", newUrl);
}
