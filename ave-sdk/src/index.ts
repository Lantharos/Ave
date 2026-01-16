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
