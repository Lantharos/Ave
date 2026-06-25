import type { TokenResponse } from "./types.js";

export function normalizeAppKeyBase64(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  return raw.replace(/ /g, "+");
}

function readHashParam(url: string | URL, key: string): string | null {
  try {
    const u = typeof url === "string" ? new URL(url) : url;
    const hash = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
    const params = new URLSearchParams(hash);
    return normalizeAppKeyBase64(params.get(key));
  } catch {
    return null;
  }
}

function readHashFlag(url: string | URL, key: string): boolean {
  try {
    const u = typeof url === "string" ? new URL(url) : url;
    const hash = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
    const params = new URLSearchParams(hash);
    const value = params.get(key);
    return value === "true" || value === "1";
  } catch {
    return false;
  }
}

export function extractAppKeyFromUrl(url: string | URL): string | null {
  return readHashParam(url, "app_key");
}

export function extractAppKeyOldFromUrl(url: string | URL): string | null {
  return readHashParam(url, "app_key_old");
}

export function extractAppPublicKeyFromUrl(url: string | URL): string | null {
  return readHashParam(url, "app_public_key");
}

export function extractAppPublicKeyOldFromUrl(url: string | URL): string | null {
  return readHashParam(url, "app_public_key_old");
}

export function extractAppPrivateKeyFromUrl(url: string | URL): string | null {
  return readHashParam(url, "app_private_key");
}

export function extractAppPrivateKeyOldFromUrl(url: string | URL): string | null {
  return readHashParam(url, "app_private_key_old");
}

export function extractAppKeyResetFromUrl(url: string | URL): boolean {
  return readHashFlag(url, "app_key_reset");
}

export function mergeAppKeyFromUrl(url: string | URL, tr: TokenResponse): TokenResponse {
  const fromFragment = extractAppKeyFromUrl(url);
  if (!fromFragment) return tr;
  return { ...tr, app_key: fromFragment };
}

export function mergeAppEncryptionFromUrl(url: string | URL, tr: TokenResponse): TokenResponse {
  let next = mergeAppKeyFromUrl(url, tr);
  const appPublicKey = extractAppPublicKeyFromUrl(url);
  const appPrivateKey = extractAppPrivateKeyFromUrl(url);
  const appKeyOld = extractAppKeyOldFromUrl(url);
  const appPublicKeyOld = extractAppPublicKeyOldFromUrl(url);
  const appPrivateKeyOld = extractAppPrivateKeyOldFromUrl(url);
  const appKeyReset = extractAppKeyResetFromUrl(url);

  if (appPublicKey) next = { ...next, app_public_key: appPublicKey };
  if (appPrivateKey) next = { ...next, app_private_key: appPrivateKey };
  if (appKeyOld) next = { ...next, app_key_old: appKeyOld };
  if (appPublicKeyOld) next = { ...next, app_public_key_old: appPublicKeyOld };
  if (appPrivateKeyOld) next = { ...next, app_private_key_old: appPrivateKeyOld };
  if (appKeyReset) next = { ...next, app_key_reset: true };
  return next;
}

const HASH_SECRET_KEYS = [
  "app_key",
  "app_key_old",
  "app_public_key",
  "app_public_key_old",
  "app_private_key",
  "app_private_key_old",
  "unwrapped_secret",
  "unwrappedSecretB64",
];

export function stripSensitiveHashFromUrlString(url: string): string {
  try {
    const u = new URL(url);
    if (!u.hash || u.hash.length <= 1) return url;
    const params = new URLSearchParams(u.hash.slice(1));
    let changed = false;
    for (const k of HASH_SECRET_KEYS) {
      if (params.has(k)) {
        params.delete(k);
        changed = true;
      }
    }
    if (!changed) return url;
    const rest = params.toString();
    u.hash = rest ? `#${rest}` : "";
    return u.toString();
  } catch {
    return url;
  }
}

export function stripOAuthQueryParamsFromUrlString(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("code");
    u.searchParams.delete("state");
    return u.toString();
  } catch {
    return url;
  }
}

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
  window.history.replaceState(window.history.state, "", newUrl);
}
