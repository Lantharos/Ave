export interface ServerConfig {
  issuer?: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TokenResponse {
  access_token: string;
  access_token_jwt: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCodeServer(config: ServerConfig, payload: { code: string }): Promise<TokenResponse> {
  const issuer = config.issuer || "https://aveid.net";
  const apiBase = issuer.replace("https://aveid.net", "https://api.aveid.net");

  const response = await fetch(`${apiBase}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "authorization_code",
      code: payload.code,
      redirectUri: config.redirectUri,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to exchange token");
  }

  return response.json();
}

export async function refreshTokenServer(config: ServerConfig, payload: { refreshToken: string }): Promise<TokenResponse> {
  const issuer = config.issuer || "https://aveid.net";
  const apiBase = issuer.replace("https://aveid.net", "https://api.aveid.net");

  const response = await fetch(`${apiBase}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "refresh_token",
      refreshToken: payload.refreshToken,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to refresh token");
  }

  return response.json();
}
