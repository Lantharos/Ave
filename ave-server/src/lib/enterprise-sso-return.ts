export function businessOrigin() {
  return process.env.BUSINESS_ORIGIN || "https://business.aveid.net";
}

function allowedReturnOrigins() {
  return new Set([
    businessOrigin(),
    process.env.RP_ORIGIN || "https://aveid.net",
    process.env.OIDC_ISSUER || "https://aveid.net",
  ].map((origin) => {
    try {
      return new URL(origin).origin;
    } catch {
      return "";
    }
  }).filter(Boolean));
}

export function enterpriseSsoReturnTo(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value, process.env.RP_ORIGIN || "https://aveid.net");
    if (!allowedReturnOrigins().has(url.origin)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
