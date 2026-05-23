import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth";
import { 
  handleWebSocketOpen, 
  handleWebSocketClose, 
  handleWebSocketMessage,
  notifyLoginRequestStatus,
} from "./lib/websocket";

// Routes
import registerRoutes from "./routes/register";
import loginRoutes from "./routes/login";
import devicesRoutes, { cleanupStaleDevices } from "./routes/devices";
import identitiesRoutes from "./routes/identities";
import securityRoutes from "./routes/security";
import activityRoutes, { cleanupExpiredActivityLogs } from "./routes/activity";
import mydataRoutes from "./routes/mydata";
import oauthRoutes, { oidcRoutes } from "./routes/oauth";
import appsRoutes from "./routes/apps";
import organizationsRoutes from "./routes/organizations";
import businessSamlRoutes from "./routes/business-saml";
import businessRoutes from "./routes/business";
import pushRoutes from "./routes/push";
import signingRoutes from "./routes/signing";
import encryptionRoutes from "./routes/encryption";

import { getCookieValue, SESSION_COOKIE_NAME } from "./lib/session-cookie";
import { initDb, runWithDb } from "./db";
import { initMail } from "./lib/mail";
import { cleanupExpiredChallenges } from "./lib/challenge-store";
import { cleanupExpiredOAuthStorage } from "./lib/oauth-store";
import { processBackgroundEventBatch, type BackgroundEvent } from "./lib/background-events";

import uploadRoutes from "./routes/upload";

type Bindings = {
  API_APP: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace;
  BACKGROUND_EVENTS?: Queue<BackgroundEvent>;
  API_ANALYTICS?: AnalyticsEngineDataset;
  DB: D1Database;
  EMAIL: SendEmail;
  UPLOADS: R2Bucket;
  INTERNAL_API_TOKEN?: string;
};

function isLocalhostHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0]?.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function allowsLocalhostOrigins(requestHost?: string | null): boolean {
  if (process.env.ALLOW_LOCALHOST_ORIGINS === "true") return true;
  if (isLocalhostHost(requestHost)) return true;

  const rpOrigin = process.env.RP_ORIGIN;
  if (!rpOrigin) return true;

  try {
    return isLocalhostHost(new URL(rpOrigin).host);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string | null | undefined, requestHost?: string | null): boolean {
  if (!origin) return false;

  if (allowsLocalhostOrigins(requestHost) && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
    return true;
  }

  try {
    const url = new URL(origin);
    if (url.protocol === "https:" && (url.hostname === "aveid.net" || url.hostname.endsWith(".aveid.net"))) {
      return true;
    }
  } catch {
    return false;
  }

  const rpOrigin = process.env.RP_ORIGIN;
  if (rpOrigin && origin === rpOrigin) {
    return true;
  }

  return false;
}

function resolveCorsOrigin(origin: string | undefined, requestHost?: string | null): string {
  if (isAllowedOrigin(origin, requestHost)) {
    return origin!;
  }
  return "https://aveid.net";
}

const D1_BOOKMARK_HEADER = "x-d1-bookmark";

function normalizeMetricPath(path: string): string {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":uuid")
    .replace(/app_[a-z0-9]+/gi, "app_:id")
    .replace(/org_[a-z0-9]+/gi, "org_:id")
    .replace(/\/[A-Za-z0-9_-]{24,}(?=\/|$)/g, "/:id");
}

function appendServerTimingHeader(response: Response, durationMs: number): Response {
  const headers = new Headers(response.headers);
  headers.append("Server-Timing", `app;dur=${durationMs.toFixed(1)}`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function recordRequestMetric(env: Bindings, request: Request, response: Response, durationMs: number): void {
  const analytics = env.API_ANALYTICS;
  if (!analytics) return;

  const url = new URL(request.url);
  const cf = (request as unknown as { cf?: { colo?: string; country?: string } }).cf;
  analytics.writeDataPoint({
    blobs: [
      request.method,
      normalizeMetricPath(url.pathname),
      String(response.status),
      cf?.colo || "unknown",
      cf?.country || "unknown",
    ],
    doubles: [durationMs],
    indexes: [url.hostname],
  });
}

async function finalizeMeasuredResponse(
  env: Bindings,
  request: Request,
  startedAt: number,
  response: Response,
  requestDatabase?: D1DatabaseSession,
): Promise<Response> {
  if (isWebSocketUpgrade(request) || response.status === 101) {
    recordRequestMetric(env, request, response, performance.now() - startedAt);
    return response;
  }

  const withBookmark = requestDatabase ? appendBookmarkHeader(response, requestDatabase) : response;
  const durationMs = performance.now() - startedAt;
  const finalResponse = appendServerTimingHeader(withBookmark, durationMs);
  recordRequestMetric(env, request, finalResponse, durationMs);
  return finalResponse;
}

function isCredentialedOAuthCorsPath(path: string): boolean {
  return path.startsWith("/api/oauth/authorize")
    || path === "/api/oauth/session/bootstrap"
    || path === "/api/oauth/authorizations"
    || path.startsWith("/api/oauth/authorization/")
    || path.startsWith("/api/oauth/authorizations/")
    || path === "/api/oauth/delegations"
    || path.startsWith("/api/oauth/delegations/")
    || path === "/api/oauth/fedcm/accounts"
    || path === "/api/oauth/fedcm/assertion"
    || path === "/api/oauth/fedcm/finalize";
}

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();

  app.use("*", async (c, next) => {
    await next();

    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

    const host = c.req.header("host");
    if (host === "api.aveid.net" || host === "aveid.net" || host?.endsWith(".aveid.net")) {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }

    if (c.req.path.startsWith("/api/") && !c.res.headers.has("Cache-Control")) {
      c.header("Cache-Control", "no-store");
    }
  });

  const publicOAuthCorsMiddleware = cors({
    origin: "*",
    credentials: false,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", D1_BOOKMARK_HEADER],
    exposeHeaders: [D1_BOOKMARK_HEADER],
  });

  const oauthCorsMiddleware = cors({
    origin: (origin, c) => {
      const path = c.req.path;
      if (path.startsWith("/api/oauth/fedcm/")) {
        return origin || "https://aveid.net";
      }
      return resolveCorsOrigin(origin, c.req.header("host"));
    },
    credentials: true,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", D1_BOOKMARK_HEADER],
    exposeHeaders: [D1_BOOKMARK_HEADER],
  });

  app.use("/api/oauth/*", async (c, next) => {
    if (isCredentialedOAuthCorsPath(c.req.path)) {
      return oauthCorsMiddleware(c, next);
    }
    return publicOAuthCorsMiddleware(c, next);
  });

  app.use("/.well-known/*", cors({
    origin: "*",
    credentials: false,
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", D1_BOOKMARK_HEADER],
    exposeHeaders: [D1_BOOKMARK_HEADER],
  }));

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/oauth/") || c.req.path.startsWith("/.well-known/")) {
      return next();
    }

    const corsMiddleware = cors({
      origin: (origin, c) => resolveCorsOrigin(origin, c.req.header("host")),
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", D1_BOOKMARK_HEADER],
      exposeHeaders: [D1_BOOKMARK_HEADER],
    });

    return corsMiddleware(c, next);
  });

  app.use("*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();

    if (c.req.path.startsWith("/api/oauth/fedcm/")) {
      return next();
    }

    const cookieHeader = c.req.header("Cookie") || "";
    const hasSessionCookie = cookieHeader.includes(`${SESSION_COOKIE_NAME}=`);
    if (!hasSessionCookie) return next();

    const origin = c.req.header("Origin");
    if (!origin) {
      if (c.req.method === "GET" || c.req.method === "HEAD") return next();
      return c.json({ error: "origin_required" }, 403);
    }

    if (isAllowedOrigin(origin, c.req.header("host"))) {
      return next();
    }

    return c.json({ error: "origin_not_allowed" }, 403);
  });

  app.use("*", authMiddleware);

  // Health check
  app.get("/", (c) => {
    return c.json({ 
      name: "Ave API",
      version: "1.0.0",
      status: "ok",
    });
  });

  // API routes
  app.route("/api/register", registerRoutes);
  app.route("/api/login", loginRoutes);
  app.route("/api/devices", devicesRoutes);
  app.route("/api/identities", identitiesRoutes);
  app.route("/api/security", securityRoutes);
  app.route("/api/activity", activityRoutes);
  app.route("/api/mydata", mydataRoutes);
  app.route("/api/oauth", oauthRoutes);
  app.route("/api/apps", appsRoutes);
  app.route("/api/organizations", organizationsRoutes);
  app.route("/api/business", businessSamlRoutes);
  app.route("/api/business", businessRoutes);
  app.route("/api/push", pushRoutes);
  app.route("/api/signing", signingRoutes);
  app.route("/api/encryption", encryptionRoutes);
  app.route("/.well-known", oidcRoutes);
  app.route("/api/upload", uploadRoutes);

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: "Not Found" }, 404);
  });

  // Error handler
  app.onError((err, c) => {
    if (err instanceof SyntaxError && /JSON|Unexpected end of JSON input/i.test(err.message)) {
      console.warn("Invalid JSON body", {
        path: c.req.path,
        method: c.req.method,
        contentType: c.req.header("content-type"),
        contentLength: c.req.header("content-length"),
      });
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    console.error("Server error:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}

const app = buildApp();

function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

function createRequestDatabase(request: Request, db: D1Database): D1DatabaseSession {
  const incomingBookmark = request.headers.get(D1_BOOKMARK_HEADER) || undefined;
  if (incomingBookmark) {
    return db.withSession(incomingBookmark);
  }

  if (isWebSocketUpgrade(request)) {
    return db.withSession("first-primary");
  }

  if (request.method === "GET" || request.method === "HEAD") {
    return db.withSession("first-unconstrained");
  }

  return db.withSession("first-primary");
}

function appendBookmarkHeader(response: Response, requestDatabase: D1DatabaseSession): Response {
  const bookmark = requestDatabase.getBookmark();
  if (!bookmark) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set(D1_BOOKMARK_HEADER, bookmark);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function createWebSocketResponse(request: Request, requestDatabase: D1Database | D1DatabaseSession): Response {
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin, request.headers.get("host"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const authToken = url.searchParams.get("token") || getCookieValue(request.headers.get("Cookie") || "", SESSION_COOKIE_NAME) || undefined;
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
        if (expectedToken && expectedToken !== providedToken) {
          return new Response("Forbidden", { status: 403 });
        }

        const payload = await request.json() as {
          requestId?: string;
          status?: "approved" | "denied";
          data?: {
            encryptedMasterKey?: string;
            approverPublicKey?: string;
          };
        };

        if (!payload.requestId || (payload.status !== "approved" && payload.status !== "denied")) {
          return Response.json({ error: "Invalid login request status payload" }, { status: 400 });
        }

        notifyLoginRequestStatus(payload.requestId, payload.status, payload.data);
        return Response.json({ success: true });
      }

      if (url.pathname === "/__internal/cleanup" && request.method === "POST") {
        const expectedToken = this.env.INTERNAL_API_TOKEN;
        const providedToken = request.headers.get("x-internal-token");
        if (expectedToken && expectedToken !== providedToken) {
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

export { RateLimitDurableObject } from "./lib/rate-limit";

function needsApiDurableObject(request: Request): boolean {
  const url = new URL(request.url);
  if (url.pathname === "/ws" && isWebSocketUpgrade(request)) {
    return true;
  }

  return url.pathname === "/api/login/request-approval";
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
      const response = await app.fetch(request, env, ctx as any);
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
