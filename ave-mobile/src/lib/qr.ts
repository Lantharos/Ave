export function parseRequestIdFromQr(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("AVE_LOGIN_REQUEST:")) {
    return value.slice("AVE_LOGIN_REQUEST:".length).trim() || null;
  }

  try {
    const parsed = JSON.parse(value) as { type?: string; requestId?: string };
    if (parsed.type === "ave_login_request" && parsed.requestId) {
      return parsed.requestId;
    }
  } catch {
    // not JSON
  }

  try {
    const url = new URL(value);
    const requestId = url.searchParams.get("requestId");
    if (requestId) return requestId;
  } catch {
    // not URL
  }

  return null;
}
