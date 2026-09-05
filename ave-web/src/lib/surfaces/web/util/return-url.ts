const STORAGE_KEY = "ave:return_url";
const allowedReturnOrigins = new Set([
  "https://aveid.net",
  "https://business.aveid.net",
  "https://devs.aveid.net",
]);

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function normalizeReturnUrl(value: string | null): string | null {
  if (!value || value !== value.trim() || /[\\\u0000-\u001f\u007f]/.test(value)) return null;

  try {
    const origin = typeof window === "undefined" ? "https://aveid.net" : window.location.origin;
    const relative = value.startsWith("/") && !value.startsWith("//");
    const url = relative ? new URL(value, origin) : new URL(value);
    if (url.username || url.password || /^\/(?:web\/)?login(?:\/|$)/.test(url.pathname)) return null;

    if (relative) {
      return url.origin === origin && !url.pathname.startsWith("//") ? `${url.pathname}${url.search}${url.hash}` : null;
    }

    if (allowedReturnOrigins.has(url.origin)) return url.href;
    if (
      typeof window !== "undefined" &&
      isLocalHostname(window.location.hostname) &&
      url.protocol === "http:" &&
      isLocalHostname(url.hostname)
    ) return url.href;
  } catch {}

  return null;
}

function getQueryReturnUrl() {
  if (typeof window === "undefined") return null;
  return normalizeReturnUrl(new URL(window.location.href).searchParams.get("return_to"));
}

export function setReturnUrl(pathWithSearch: string) {
  const url = normalizeReturnUrl(pathWithSearch);
  if (!url) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, url);
  } catch {}
}

export function getReturnUrl(): string | null {
  const queryReturnUrl = getQueryReturnUrl();
  if (queryReturnUrl) return queryReturnUrl;

  try {
    return normalizeReturnUrl(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearReturnUrl() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}
