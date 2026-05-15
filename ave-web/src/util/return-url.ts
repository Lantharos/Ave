const STORAGE_KEY = "ave:return_url";
const allowedAbsoluteReturnHosts = new Set(["aveid.net", "business.aveid.net", "devs.aveid.net"]);

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function isLocalLoginHost() {
  if (typeof window === "undefined") return false;
  return isLocalHostname(window.location.hostname);
}

function isValidAbsoluteReturnUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.pathname.startsWith("/login")) return false;
    if (url.protocol === "https:" && allowedAbsoluteReturnHosts.has(url.hostname)) return true;
    if (isLocalLoginHost() && url.protocol === "http:" && isLocalHostname(url.hostname)) return true;
  } catch {
  }

  return false;
}

function isValidReturnUrl(value: string | null): value is string {
  if (!value) return false;
  if (value.startsWith("/") && !value.startsWith("//")) {
    return !value.startsWith("/login");
  }

  return isValidAbsoluteReturnUrl(value);
}

function getQueryReturnUrl() {
  if (typeof window === "undefined") return null;

  try {
    const value = new URL(window.location.href).searchParams.get("return_to");
    return isValidReturnUrl(value) ? value : null;
  } catch {
    return null;
  }
}

export function setReturnUrl(pathWithSearch: string) {
  if (!isValidReturnUrl(pathWithSearch)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, pathWithSearch);
  } catch {
    // Ignore storage errors
  }
}

export function getReturnUrl(): string | null {
  const queryReturnUrl = getQueryReturnUrl();
  if (queryReturnUrl) return queryReturnUrl;

  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    return isValidReturnUrl(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearReturnUrl() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
