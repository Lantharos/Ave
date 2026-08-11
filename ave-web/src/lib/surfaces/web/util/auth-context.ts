import { api } from "../lib/api";
import { getReturnUrl } from "./return-url";

export interface PendingAuthContext {
  appName: string | null;
  appIconUrl: string | null;
  clientId: string | null;
  isQuickAuth: boolean;
  originHostname: string | null;
}

function publicPathname(pathname: string) {
  return pathname === "/web"
    ? "/"
    : pathname.startsWith("/web/")
      ? pathname.slice(4)
      : pathname;
}

function isAuthRequestUrl(url: URL) {
  const pathname = publicPathname(url.pathname);
  if (pathname === "/authorize" || pathname === "/signin") {
    return url.searchParams.has("client_id");
  }

  return pathname === "/login"
    && url.searchParams.has("client_id")
    && url.searchParams.has("redirect_uri");
}

function parsePendingAuthLocation() {
  const currentUrl = new URL(window.location.href);
  if (isAuthRequestUrl(currentUrl)) {
    return currentUrl;
  }

  const returnUrl = getReturnUrl();
  if (!returnUrl) {
    return null;
  }

  const url = new URL(returnUrl, window.location.origin);
  return isAuthRequestUrl(url) ? url : null;
}

export function hasPendingAuthRequest() {
  return parsePendingAuthLocation() !== null;
}

export async function loadPendingAuthContext(): Promise<PendingAuthContext | null> {
  const pendingUrl = parsePendingAuthLocation();
  if (!pendingUrl) {
    return null;
  }

  const clientId = pendingUrl.searchParams.get("client_id");
  if (!clientId) {
    return null;
  }

  if (clientId.startsWith("origin:")) {
    try {
      const origin = new URL(clientId.slice("origin:".length));
      return {
        appName: origin.hostname,
        appIconUrl: null,
        clientId,
        isQuickAuth: true,
        originHostname: origin.hostname,
      };
    } catch {
      return {
        appName: null,
        appIconUrl: null,
        clientId,
        isQuickAuth: true,
        originHostname: null,
      };
    }
  }

  try {
    const appData = await api.oauth.getApp(clientId);
    return {
      appName: appData.app.name,
      appIconUrl: appData.app.iconUrl || null,
      clientId,
      isQuickAuth: false,
      originHostname: null,
    };
  } catch {
    return {
      appName: null,
      appIconUrl: null,
      clientId,
      isQuickAuth: false,
      originHostname: null,
    };
  }
}
