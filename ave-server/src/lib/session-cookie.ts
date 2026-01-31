import { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

export const SESSION_COOKIE_NAME = "ave_session";

function getCookieDomain(c: Context): string | undefined {
  const envDomain = process.env.COOKIE_DOMAIN;
  if (envDomain) return envDomain;

  const host = c.req.header("host") || "";
  if (host === "aveid.net" || host.endsWith(".aveid.net")) return ".aveid.net";
  return undefined;
}

function isSecureContext(c: Context): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  const forwarded = c.req.header("x-forwarded-proto");
  if (forwarded === "https") return true;

  const host = c.req.header("host") || "";
  if (host === "aveid.net" || host.endsWith(".aveid.net")) return true;
  return false;
}

export function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  const secure = isSecureContext(c);
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: secure ? "None" : "Lax",
    path: "/",
    domain: getCookieDomain(c),
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
    domain: getCookieDomain(c),
  });
}
