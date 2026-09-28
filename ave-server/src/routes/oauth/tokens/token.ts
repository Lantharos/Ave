import { Hono } from "hono";
import { enforceNativeRateLimits, getClientIp, ipRateLimit, subjectRateLimit } from "../../../lib/platform/rate-limit";
import { handleAuthorizationCode } from "./authorization-code";
import { handleRefreshToken } from "./refresh-token";
import { readTokenRequest } from "./token-request";

const app = new Hono();

app.post("/token", async (c) => {
  const request = await readTokenRequest(c);
  if (!request.ok) {
    return c.json({ error: request.error, error_description: request.description }, request.error === "invalid_client" ? 401 : 400);
  }
  const { payload } = request;
  const rateLimitResponse = await enforceNativeRateLimits(c, [
    {
      binding: "OAUTH_TOKEN_IP_RATE_LIMITER",
      key: `ip:${getClientIp(c)}`,
      periodSeconds: 60,
      fallback: ipRateLimit(c, "oauth:token:ip", 300, 60 * 1000),
    },
    {
      binding: "OAUTH_CLIENT_RATE_LIMITER",
      key: `token:${payload.clientId}`,
      periodSeconds: 60,
      fallback: subjectRateLimit("oauth:token:client", payload.clientId, 180, 60 * 1000),
    },
  ]);
  if (rateLimitResponse) return rateLimitResponse;

  switch (payload.grantType) {
    case "refresh_token":
      return handleRefreshToken(c, payload);
    case "authorization_code":
      return handleAuthorizationCode(c, payload);
  }
});

export default app;
