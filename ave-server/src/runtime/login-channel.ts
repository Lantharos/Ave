import { handleWebSocketClose, handleWebSocketMessage, handleWebSocketOpen, notifyLoginRequest, notifyLoginRequestStatus } from "../lib/platform/websocket";
import { initDb, runWithDb } from "../db";
import { initMail } from "../lib/notifications/mail";
import { getCookieValue, SESSION_COOKIE_NAME } from "../lib/auth/session-cookie";
import { cleanupExpiredActivityLogs } from "../routes/account/activity";
import { cleanupStaleDevices } from "../routes/account/devices";
import { cleanupExpiredChallenges } from "../lib/auth/challenge-store";
import { cleanupExpiredOAuthStorage } from "../lib/oauth/oauth-store";
import { app } from "./app";
import type { Bindings } from "./bindings";
import { createRequestDatabase, isWebSocketUpgrade } from "./request-database";
import { finalizeMeasuredResponse } from "./metrics";
import { isAllowedOrigin } from "./origins";

function createWebSocketResponse(request: Request, requestDatabase: D1Database | D1DatabaseSession): Response {
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin, request.headers.get("host"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const authToken = getCookieValue(request.headers.get("Cookie") || "", SESSION_COOKIE_NAME) || undefined;
  const requestId = url.searchParams.get("requestId") || undefined;

  const webSocketPair = new WebSocketPair();
  const client = webSocketPair[0];
  const server = webSocketPair[1];
  server.accept();

  void runWithDb(requestDatabase, () =>
    handleWebSocketOpen(server as unknown as WebSocket, { authToken, requestId })
  ).catch((error) => {
    console.error("WebSocket open handler failed:", error);
  });

  server.addEventListener("message", (event) => {
    const msg = typeof event.data === "string" ? event.data : String(event.data);
    void runWithDb(requestDatabase, () =>
      handleWebSocketMessage(server as unknown as WebSocket, msg)
    ).catch((error) => {
      console.error("WebSocket message handler failed:", error);
    });
  });

  server.addEventListener("close", () => {
    void runWithDb(requestDatabase, async () => {
      await handleWebSocketClose(server as unknown as WebSocket);
    }).catch((error) => {
      console.error("WebSocket close handler failed:", error);
    });
  });

  server.addEventListener("error", (event) => {
    console.warn("WebSocket error event:", event);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

export class ApiAppDurableObject {
  constructor(
    _state: DurableObjectState,
    private readonly env: Bindings
  ) {}

  async fetch(request: Request): Promise<Response> {
    initDb(this.env.DB);
    initMail(this.env.EMAIL);
    const startedAt = performance.now();
    const requestDatabase = createRequestDatabase(request, this.env.DB);

    return runWithDb(requestDatabase, async () => {
      const url = new URL(request.url);

      if (url.pathname === "/ws" && isWebSocketUpgrade(request)) {
        return createWebSocketResponse(request, requestDatabase);
      }

      if (url.pathname === "/__internal/login-request-status" && request.method === "POST") {
        const expectedToken = this.env.INTERNAL_API_TOKEN;
        const providedToken = request.headers.get("x-internal-token");
        if (!expectedToken || expectedToken !== providedToken) {
          return new Response("Forbidden", { status: 403 });
        }

        const payload = await request.json() as {
          requestId?: string;
          status?: "approved" | "denied";
        };

        if (!payload.requestId || (payload.status !== "approved" && payload.status !== "denied")) {
          return Response.json({ error: "Invalid login request status payload" }, { status: 400 });
        }

        notifyLoginRequestStatus(payload.requestId, payload.status);
        return Response.json({ success: true });
      }

      if (url.pathname === "/__internal/login-request" && request.method === "POST") {
        const expectedToken = this.env.INTERNAL_API_TOKEN;
        const providedToken = request.headers.get("x-internal-token");
        if (!expectedToken || expectedToken !== providedToken) {
          return new Response("Forbidden", { status: 403 });
        }

        const payload = await request.json() as {
          handle?: string;
          request?: {
            id: string;
            deviceName: string | null;
            deviceType: string | null;
            browser: string | null;
            os: string | null;
            ipAddress: string | null;
          };
        };

        if (!payload.handle || !payload.request?.id) {
          return Response.json({ error: "Invalid login request payload" }, { status: 400 });
        }

        await notifyLoginRequest(payload.handle, payload.request);
        return Response.json({ success: true });
      }

      if (url.pathname === "/__internal/cleanup" && request.method === "POST") {
        const expectedToken = this.env.INTERNAL_API_TOKEN;
        const providedToken = request.headers.get("x-internal-token");
        if (!expectedToken || expectedToken !== providedToken) {
          return new Response("Forbidden", { status: 403 });
        }

        const [deviceCleanup, activityCleanup, challengeCleanup, oauthStorageCleanup] = await Promise.all([
          cleanupStaleDevices(),
          cleanupExpiredActivityLogs(),
          cleanupExpiredChallenges(),
          cleanupExpiredOAuthStorage(),
        ]);
        return finalizeMeasuredResponse(this.env, request, startedAt, Response.json({
          success: true,
          ...deviceCleanup,
          activityRetentionDays: activityCleanup.retentionDays,
          ...challengeCleanup,
          ...oauthStorageCleanup,
        }), requestDatabase);
      }

      const response = await app.fetch(request, this.env);
      return finalizeMeasuredResponse(this.env, request, startedAt, response, requestDatabase);
    });
  }
}
