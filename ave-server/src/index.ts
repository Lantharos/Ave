import { initDb, runWithDb } from "./db";
import { initMail } from "./lib/notifications/mail";
import { cleanupExpiredActivityLogs } from "./routes/account/activity";
import { cleanupStaleDevices } from "./routes/account/devices";
import { cleanupExpiredChallenges } from "./lib/auth/challenge-store";
import { cleanupExpiredOAuthStorage } from "./lib/oauth/oauth-store";
import { app } from "./runtime/app";
import type { Bindings } from "./runtime/bindings";
import { createRequestDatabase, isWebSocketUpgrade } from "./runtime/request-database";
import { finalizeMeasuredResponse } from "./runtime/metrics";
import { processBackgroundEventBatch, type BackgroundEvent } from "./lib/platform/background-events";
export { ApiAppDurableObject } from "./runtime/login-channel";

export { RateLimitDurableObject } from "./lib/platform/rate-limit";

function needsApiDurableObject(request: Request): boolean {
  const url = new URL(request.url);
  return url.pathname === "/ws" && isWebSocketUpgrade(request);
}

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    initDb(env.DB);
    initMail(env.EMAIL);
    const startedAt = performance.now();

    const url = new URL(request.url);
    if (url.pathname.startsWith("/__internal/")) {
      return finalizeMeasuredResponse(env, request, startedAt, new Response("Not Found", { status: 404 }));
    }

    if (needsApiDurableObject(request)) {
      const id = env.API_APP.idFromName("primary");
      const stub = env.API_APP.get(id);
      const response = await stub.fetch(request);
      return finalizeMeasuredResponse(env, request, startedAt, response);
    }

    const requestDatabase = createRequestDatabase(request, env.DB);
    return runWithDb(requestDatabase, async () => {
      const response = await app.fetch(request, env, ctx);
      return finalizeMeasuredResponse(env, request, startedAt, response, requestDatabase);
    });
  },

  async queue(batch: MessageBatch<BackgroundEvent>, env: Bindings): Promise<void> {
    initDb(env.DB);
    initMail(env.EMAIL);
    await runWithDb(env.DB.withSession("first-primary"), () => processBackgroundEventBatch(batch));
  },

  async scheduled(_: ScheduledController, env: Bindings, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runWithDb(env.DB.withSession("first-primary"), async () => {
        initDb(env.DB);
        initMail(env.EMAIL);
        const [deviceCleanup, activityCleanup, challengeCleanup, oauthStorageCleanup] = await Promise.all([
          cleanupStaleDevices(),
          cleanupExpiredActivityLogs(),
          cleanupExpiredChallenges(),
          cleanupExpiredOAuthStorage(),
        ]);
        return {
          ...deviceCleanup,
          activityRetentionDays: activityCleanup.retentionDays,
          ...challengeCleanup,
          ...oauthStorageCleanup,
        };
      }).catch((err) => {
        console.error("[Cron] Device cleanup failed:", err);
      })
    );
  },
};
