export function enterpriseSsoRedirect(data: unknown, apiBase: string, returnTo: string): string | null {
  if (!data || typeof data !== "object" || !("error" in data) || data.error !== "enterprise_sso_required"
    || !("loginUrl" in data) || typeof data.loginUrl !== "string") return null;
  if (!URL.canParse(apiBase) || !URL.canParse(returnTo) || !URL.canParse(data.loginUrl, apiBase)) return null;

  const apiOrigin = new URL(apiBase).origin;
  const target = new URL(data.loginUrl, apiOrigin);
  if (target.origin !== apiOrigin || target.username || target.password
    || !/^\/api\/business\/sso\/(oidc|saml)\/[a-zA-Z0-9_-]+\/start$/.test(target.pathname)) return null;

  const destination = new URL(returnTo);
  if ("organization" in data && data.organization && typeof data.organization === "object"
    && "id" in data.organization && typeof data.organization.id === "string") {
    destination.searchParams.set("organizationId", data.organization.id);
  }
  target.search = new URLSearchParams({ return_to: destination.toString() }).toString();
  target.hash = "";
  return target.toString();
}
