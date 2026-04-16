export function getApiBase(issuer?: string): string {
  const base = issuer || "https://aveid.net";
  return base.replace("https://aveid.net", "https://api.aveid.net");
}
