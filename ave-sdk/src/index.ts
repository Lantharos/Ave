export type Scope = "openid" | "profile" | "email" | "offline_access" | "user_id";

export interface AveConfig {
  clientId: string;
  redirectUri: string;
  issuer?: string;
}

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

export function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, 32);
}

export function buildAuthorizeUrl(config: AveConfig, params: {
  scope?: Scope[];
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256" | "plain";
  extraParams?: Record<string, string>;
} = {}): string {
  const issuer = config.issuer || "https://aveid.net";
  const search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: (params.scope || ["openid", "profile", "email"]).join(" "),
    state: params.state || "",
    nonce: params.nonce || "",
    ...params.extraParams,
  });

  if (params.codeChallenge) {
    search.set("code_challenge", params.codeChallenge);
    search.set("code_challenge_method", params.codeChallengeMethod || "S256");
  }

  return `${issuer}/signin?${search.toString()}`;
}

export async function exchangeCode(config: AveConfig, payload: {
  code: string;
  codeVerifier?: string;
}): Promise<import("./types").TokenResponse> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetch(`${apiBase}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "authorization_code",
      code: payload.code,
      redirectUri: config.redirectUri,
      clientId: config.clientId,
      codeVerifier: payload.codeVerifier,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to exchange token");
  }

  return response.json();
}

export async function refreshToken(config: AveConfig, payload: { refreshToken: string }): Promise<import("./types").TokenResponse> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetch(`${apiBase}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "refresh_token",
      refreshToken: payload.refreshToken,
      clientId: config.clientId,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to refresh token");
  }

  return response.json();
}

export async function fetchUserInfo(config: AveConfig, accessToken: string): Promise<import("./types").UserInfo> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetch(`${apiBase}/api/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to fetch user info");
  }

  return response.json();
}

export function getApiBase(issuer?: string): string {
  const base = issuer || "https://aveid.net";
  return base.replace("https://aveid.net", "https://api.aveid.net");
}

function base64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ============================================
// Ave Signing
// ============================================

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
): Promise<import("./types").SignatureRequest> {
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
): Promise<import("./types").SignatureResult> {
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
  options?: { embed?: boolean }
): string {
  const issuer = config.issuer || "https://aveid.net";
  const params = new URLSearchParams({ requestId });
  
  if (options?.embed) {
    params.set("embed", "1");
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
