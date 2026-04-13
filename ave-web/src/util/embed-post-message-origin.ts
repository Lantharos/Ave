/**
 * OAuth embed flows include redirect_uri. The registered app's origin is the
 * correct postMessage target — never use "*" when we have it.
 */
export function postMessageTargetOriginFromRedirectUri(redirectUri: string): string {
  if (!redirectUri.trim()) return "*";
  try {
    return new URL(redirectUri).origin;
  } catch {
    return "*";
  }
}

/**
 * Signing embed may pass parent_origin when redirect_uri is not in the URL.
 */
export function postMessageTargetOriginForSigning(
  redirectUri: string | undefined,
  parentOriginParam: string | null
): string {
  const fromRedirect = redirectUri?.trim() ? postMessageTargetOriginFromRedirectUri(redirectUri) : null;
  if (fromRedirect && fromRedirect !== "*") return fromRedirect;
  if (parentOriginParam?.trim()) {
    try {
      const o = new URL(parentOriginParam);
      if (o.protocol === "https:" || o.protocol === "http:") return o.origin;
    } catch {
      try {
        return new URL(`https://${parentOriginParam}`).origin;
      } catch {
        /* ignore */
      }
    }
  }
  return "*";
}
