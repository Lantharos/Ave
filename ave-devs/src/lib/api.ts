const API_BASE = import.meta.env.VITE_API_URL || "https://api.aveid.net";
const TOKEN_URL = `${API_BASE}/api/oauth/token`;
const USERINFO_URL = `${API_BASE}/api/oauth/userinfo`;

export interface TokenResponse {
  access_token: string;
  access_token_jwt: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  scope: string;
}

export interface UserInfo {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  picture?: string;
  iss?: string;
  user_id?: string;
}

export interface DevApp {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  iconUrl?: string;
  redirectUris: string[];
  supportsE2ee: boolean;
  allowedScopes: string[];
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  allowUserIdScope: boolean;
  createdAt: string;
}

export interface CreateAppPayload {
  name: string;
  description?: string;
  websiteUrl?: string;
  iconUrl?: string;
  redirectUris: string[];
  supportsE2ee: boolean;
  allowedScopes: string[];
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  allowUserIdScope?: boolean;
}

export async function exchangeCode(payload: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "authorization_code",
      code: payload.code,
      redirectUri: payload.redirectUri,
      clientId: payload.clientId,
      codeVerifier: payload.codeVerifier,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to exchange token");
  }

  return response.json();
}

export async function refreshToken(payload: {
  refreshToken: string;
  clientId: string;
}): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "refresh_token",
      refreshToken: payload.refreshToken,
      clientId: payload.clientId,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to refresh token");
  }

  return response.json();
}

export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to fetch user info");
  }

  return response.json();
}

export async function fetchApps(accessTokenJwt: string): Promise<DevApp[]> {
  const response = await fetch(`${API_BASE}/api/apps`, {
    headers: {
      Authorization: `Bearer ${accessTokenJwt}`,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to load apps");
  }

  const data = await response.json();
  return data.apps as DevApp[];
}

export async function createApp(accessTokenJwt: string, payload: CreateAppPayload): Promise<{ app: DevApp; clientSecret: string }> {
  const response = await fetch(`${API_BASE}/api/apps`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessTokenJwt}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to create app");
  }

  return response.json();
}

export async function rotateSecret(accessTokenJwt: string, appId: string): Promise<{ clientSecret: string }> {
  const response = await fetch(`${API_BASE}/api/apps/${appId}/rotate-secret`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessTokenJwt}`,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to rotate secret");
  }

  return response.json();
}

export async function updateApp(accessTokenJwt: string, appId: string, payload: Partial<CreateAppPayload>): Promise<{ app: DevApp }> {
  const response = await fetch(`${API_BASE}/api/apps/${appId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessTokenJwt}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to update app");
  }

  return response.json();
}

export async function deleteApp(accessTokenJwt: string, appId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/apps/${appId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessTokenJwt}`,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to delete app");
  }

  return response.json();
}
