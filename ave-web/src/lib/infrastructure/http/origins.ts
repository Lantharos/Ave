function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

export function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return trimTrailingSlash(configured);
  if (typeof window !== "undefined" && isLocalHostname(window.location.hostname)) return "http://localhost:3000";
  return "https://api.aveid.net";
}

export function resolveAveOrigin(): string {
  const configured = import.meta.env.VITE_AVE_ORIGIN?.trim();
  if (configured) return trimTrailingSlash(configured);
  if (typeof window !== "undefined" && isLocalHostname(window.location.hostname)) return "http://localhost:5173";
  return "https://aveid.net";
}
