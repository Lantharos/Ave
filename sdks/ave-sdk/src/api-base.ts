export function getApiBase(issuer?: string): string {
  const raw = issuer?.trim() || "https://aveid.net";
  try {
    const url = new URL(raw);
    if (url.hostname === "aveid.net") {
      url.hostname = "api.aveid.net";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return "https://api.aveid.net";
  }
}
