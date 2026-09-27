function isLocalhostHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0]?.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function allowsLocalhostOrigins(requestHost?: string | null): boolean {
  if (process.env.ALLOW_LOCALHOST_ORIGINS === "true") return true;
  if (isLocalhostHost(requestHost)) return true;

  const rpOrigin = process.env.RP_ORIGIN;
  if (!rpOrigin) return true;

  try {
    return isLocalhostHost(new URL(rpOrigin).host);
  } catch {
    return false;
  }
}

export function isAllowedOrigin(origin: string | null | undefined, requestHost?: string | null): boolean {
  if (!origin) return false;

  if (allowsLocalhostOrigins(requestHost) && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
    return true;
  }

  try {
    const url = new URL(origin);
    if (url.protocol === "https:" && ["aveid.net", "devs.aveid.net"].includes(url.hostname)) {
      return true;
    }
  } catch {
    return false;
  }

  const rpOrigin = process.env.RP_ORIGIN;
  if (rpOrigin && origin === rpOrigin) {
    return true;
  }

  return false;
}

export function resolveCorsOrigin(origin: string | undefined, requestHost?: string | null): string {
  if (isAllowedOrigin(origin, requestHost)) {
    return origin!;
  }
  return "https://aveid.net";
}
