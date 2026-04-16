import { getApiBase } from "./api-base.js";
import type { AveConfig } from "./types.js";
import type { TokenResponse } from "./types.js";

export async function refreshAccessToken(
  config: AveConfig,
  payload: { refreshToken: string },
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
): Promise<TokenResponse> {
  const apiBase = getApiBase(config.issuer);
  const response = await fetchImpl(`${apiBase}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "refresh_token",
      refreshToken: payload.refreshToken,
      clientId: config.clientId,
    }),
  });

  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error || "Failed to refresh token");
  }

  return response.json() as Promise<TokenResponse>;
}
