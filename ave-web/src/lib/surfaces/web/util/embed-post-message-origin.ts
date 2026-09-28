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
