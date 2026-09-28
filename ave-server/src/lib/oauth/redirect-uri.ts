import type { OAuthApp } from "../../db/schema";

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (normalized === "localhost" || normalized === "::1" || normalized === "[::1]") {
    return true;
  }

  const parts = normalized.split(".");
  if (parts.length !== 4 || parts[0] !== "127") {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function isLoopbackRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && isLoopbackHostname(url.hostname);
  } catch {
    return false;
  }
}

export function normalizeRedirectUri(value: string): string {
  const trimmed = value.trim();

  try {
    return new URL(trimmed).toString();
  } catch {
  }

  try {
    const decoded = decodeURIComponent(trimmed);
    return new URL(decoded).toString();
  } catch {
    return trimmed;
  }
}

function isExpoGoRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "exp:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isRedirectUriAllowedForApp(app: Pick<OAuthApp, "redirectUris" | "developmentMode">, redirectUri: string): boolean {
  const redirectUris = (app.redirectUris || []) as string[];
  return redirectUris.includes(redirectUri) || (!!app.developmentMode && (isLoopbackRedirectUri(redirectUri) || isExpoGoRedirectUri(redirectUri)));
}

