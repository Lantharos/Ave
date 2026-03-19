import { api } from "../lib/api";
import { getReturnUrl } from "./return-url";

export interface PendingAuthContext {
  appName: string | null;
  clientId: string | null;
  isQuickAuth: boolean;
  originHostname: string | null;
}

function parsePendingAuthLocation() {
  const returnUrl = getReturnUrl();
  if (!returnUrl) {
    return null;
  }

  const url = new URL(returnUrl, window.location.origin);
  if (url.pathname !== "/authorize" && url.pathname !== "/signin") {
    return null;
  }

  return url;
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
        clientId,
        isQuickAuth: true,
        originHostname: origin.hostname,
      };
    } catch {
      return {
        appName: null,
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
      clientId,
      isQuickAuth: false,
      originHostname: null,
    };
  } catch {
    return {
      appName: null,
      clientId,
      isQuickAuth: false,
      originHostname: null,
    };
  }
}
