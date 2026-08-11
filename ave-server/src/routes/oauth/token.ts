import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { enforceNativeRateLimits, getClientIp, ipRateLimit, subjectRateLimit } from "../../lib/rate-limit";
import { handleAuthorizationCode } from "./authorization-code";
import { handleRefreshToken } from "./refresh-token";
import { oauthTokenRequestSchema } from "./token-schema";
import { handleTokenExchange } from "./token-exchange";

const app = new Hono();

app.post("/token", zValidator("json", oauthTokenRequestSchema), async (c) => {
  const payload = c.req.valid("json");
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
    case "urn:ietf:params:oauth:grant-type:token-exchange":
      return handleTokenExchange(c, payload);
    case "refresh_token":
      return handleRefreshToken(c, payload);
    case "authorization_code":
      return handleAuthorizationCode(c, payload);
  }
});

export default app;
