import { getApiBase } from "./oauth/api-base.js";

export interface SigningConfig {
  clientId: string;
  clientSecret: string;
  issuer?: string;
}

/**
 * Create a signature request for a user identity
 * This is called from your server with client credentials
 */
export async function createSignatureRequest(
  config: SigningConfig,
  params: {
    identityId: string;
    payload: string;
    metadata?: Record<string, unknown>;
    expiresInSeconds?: number;
  }
): Promise<import("./types.js").SignatureRequest> {
  const apiBase = getApiBase(config.issuer);

  const response = await fetch(`${apiBase}/api/signing/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      identityId: params.identityId,
      payload: params.payload,
      metadata: params.metadata,
      expiresInSeconds: params.expiresInSeconds || 300,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to create signature request");
  }

  return response.json();
}

/**
 * Check the status of a signature request
 */
export async function getSignatureStatus(
  config: { clientId: string; issuer?: string },
  requestId: string
): Promise<import("./types.js").SignatureResult> {
  const apiBase = getApiBase(config.issuer);

  const response = await fetch(
    `${apiBase}/api/signing/request/${requestId}/status?clientId=${encodeURIComponent(config.clientId)}`
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to get signature status");
  }

  return response.json();
}

/**
 * Get the public signing key for an identity by handle
 */
export async function getPublicKey(
  config: { issuer?: string },
  handle: string
): Promise<{ handle: string; publicKey: string; createdAt: string }> {
  const apiBase = getApiBase(config.issuer);

  const response = await fetch(`${apiBase}/api/signing/public-key/${encodeURIComponent(handle)}`);

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to get public key");
  }

  return response.json();
}

/**
 * Verify a signature using the Ave API
 */
export async function verifySignature(
  config: { issuer?: string },
  params: {
    message: string;
    signature: string;
    publicKey: string;
  }
): Promise<{ valid: boolean; error?: string }> {
  const apiBase = getApiBase(config.issuer);

  const response = await fetch(`${apiBase}/api/signing/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to verify signature");
  }

  return response.json();
}

/**
 * Build the URL to redirect a user for signing
 * Use this for browser-based signing flows
 */
export function buildSigningUrl(
  config: { issuer?: string },
  requestId: string,
  options?: { embed?: boolean; redirectUri?: string; parentOrigin?: string }
): string {
  const issuer = config.issuer || "https://aveid.net";
  const params = new URLSearchParams({ requestId });

  if (options?.embed) {
    params.set("embed", "1");
  }
  if (options?.redirectUri) {
    params.set("redirect_uri", options.redirectUri);
  }
  if (options?.parentOrigin) {
    params.set("parent_origin", options.parentOrigin);
  }

  return `${issuer}/sign?${params.toString()}`;
}

/**
 * Open a popup window for signing
 * Returns a promise that resolves when the user signs or denies
 */
export function openSigningPopup(
  config: { issuer?: string },
  requestId: string
): Promise<{ signed: boolean; signature?: string; publicKey?: string }> {
  return new Promise((resolve, reject) => {
    const url = buildSigningUrl(config, requestId);
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      "ave-signing",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (!popup) {
      reject(new Error("Failed to open popup - blocked by browser?"));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== (config.issuer || "https://aveid.net")) return;

      if (event.data?.type === "ave:signed") {
        window.removeEventListener("message", handleMessage);
        popup.close();
        resolve({
          signed: true,
          signature: event.data.payload.signature,
          publicKey: event.data.payload.publicKey,
        });
      } else if (event.data?.type === "ave:denied") {
        window.removeEventListener("message", handleMessage);
        popup.close();
        resolve({ signed: false });
      }
    };

    window.addEventListener("message", handleMessage);

    // Check if popup was closed without action
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        resolve({ signed: false });
      }
    }, 500);
  });
}
