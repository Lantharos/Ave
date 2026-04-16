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
    const raw = await response.text();
    let message = `Failed to refresh token (${response.status} ${response.statusText})`;
    try {
      const data = JSON.parse(raw) as { error?: string; error_description?: string };
      const part = data.error_description || data.error;
      if (part) message = `${message}: ${part}`;
      else if (raw) message = `${message}: ${raw.slice(0, 500)}`;
    } catch {
      if (raw) message = `${message}: ${raw.slice(0, 500)}`;
    }
    const err = new Error(message) as Error & { status: number };
    err.status = response.status;
    throw err;
  }

  return response.json() as Promise<TokenResponse>;
}
