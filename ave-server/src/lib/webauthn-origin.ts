function isAllowedWebauthnOrigin(origin: string): boolean {
  const prodOrigin = process.env.RP_ORIGIN;
  const developmentOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (developmentOrigin && (!prodOrigin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(prodOrigin))) return true;
  if (prodOrigin && origin === prodOrigin) return true;
  const rpId = process.env.RP_ID || "localhost";
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && (url.hostname === rpId || url.hostname.endsWith(`.${rpId}`));
  } catch {
  }
  return false;
}

export function extractAllowedWebauthnOrigin(clientDataJSON: string): string | null {
  try {
    const data = JSON.parse(Buffer.from(clientDataJSON, "base64url").toString("utf-8")) as { origin?: unknown };
    return typeof data.origin === "string" && isAllowedWebauthnOrigin(data.origin) ? data.origin : null;
  } catch {
    return null;
  }
}
