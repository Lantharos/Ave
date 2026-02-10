import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth";
import { 
  handleWebSocketOpen, 
  handleWebSocketClose, 
  handleWebSocketMessage 
} from "./lib/websocket";

// Routes
import registerRoutes from "./routes/register";
import loginRoutes from "./routes/login";
import devicesRoutes, { cleanupStaleDevices } from "./routes/devices";
import identitiesRoutes from "./routes/identities";
import securityRoutes from "./routes/security";
import activityRoutes from "./routes/activity";
import mydataRoutes from "./routes/mydata";
import oauthRoutes, { oidcRoutes } from "./routes/oauth";
import appsRoutes from "./routes/apps";
import pushRoutes from "./routes/push";
import signingRoutes from "./routes/signing";

import { SESSION_COOKIE_NAME } from "./lib/session-cookie";
import { initDb, runWithDb } from "./db";
import { initChallengeStorage } from "./lib/challenge-store";

import uploadRoutes from "./routes/upload";

type Bindings = {
  API_APP: DurableObjectNamespace;
  DB: D1Database;
  INTERNAL_API_TOKEN?: string;
};

function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;

  if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
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

function resolveCorsOrigin(origin: string | undefined): string {
  if (isAllowedOrigin(origin)) {
    return origin!;
  }
  return "https://aveid.net";
}

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();

  app.use("/api/oauth/*", cors({
    origin: (origin) => resolveCorsOrigin(origin),
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }));

  app.use("/.well-known/*", cors({
    origin: (origin) => resolveCorsOrigin(origin),
    credentials: true,
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }));

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/oauth/") || c.req.path.startsWith("/.well-known/")) {
      return next();
    }

    const corsMiddleware = cors({
      origin: (origin) => resolveCorsOrigin(origin),
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    });

    return corsMiddleware(c, next);
  });

  app.use("*", async (c, next) => {
    if (c.req.method === "OPTIONS") return next();

    const cookieHeader = c.req.header("Cookie") || "";
    const hasSessionCookie = cookieHeader.includes(`${SESSION_COOKIE_NAME}=`);
    if (!hasSessionCookie) return next();

    const origin = c.req.header("Origin");
    if (!origin) {
      if (c.req.method === "GET" || c.req.method === "HEAD") return next();
      return c.json({ error: "origin_required" }, 403);
    }

    if (isAllowedOrigin(origin)) {
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
  app.route("/api/push", pushRoutes);
  app.route("/api/signing", signingRoutes);
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

function createRequestDatabase(db: D1Database): D1Database | D1DatabaseSession {
  return db.withSession("first-primary");
}

function createWebSocketResponse(request: Request, requestDatabase: D1Database | D1DatabaseSession): Response {
  const url = new URL(request.url);
  const authToken = url.searchParams.get("token") || undefined;
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
    try {
      runWithDb(requestDatabase, () =>
        handleWebSocketClose(server as unknown as WebSocket)
      );
    } catch (error) {
      console.error("WebSocket close handler failed:", error);
    }
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
    state: DurableObjectState,
    private readonly env: Bindings
  ) {
    initChallengeStorage(state.storage);
  }

  async fetch(request: Request): Promise<Response> {
    initDb(this.env.DB);
    const requestDatabase = createRequestDatabase(this.env.DB);

    return runWithDb(requestDatabase, async () => {
      const url = new URL(request.url);

      if (url.pathname === "/ws" && isWebSocketUpgrade(request)) {
        return createWebSocketResponse(request, requestDatabase);
      }

      if (url.pathname === "/__internal/cleanup" && request.method === "POST") {
        const expectedToken = this.env.INTERNAL_API_TOKEN;
        const providedToken = request.headers.get("x-internal-token");
        if (expectedToken && expectedToken !== providedToken) {
          return new Response("Forbidden", { status: 403 });
        }

        const result = await cleanupStaleDevices();
        return Response.json({ success: true, ...result });
      }

      return app.fetch(request, this.env);
    });
  }
}

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    initDb(env.DB);

    const url = new URL(request.url);
    if (url.pathname.startsWith("/__internal/")) {
      return new Response("Not Found", { status: 404 });
    }

    const id = env.API_APP.idFromName("primary");
    const stub = env.API_APP.get(id);

    // WebSocket upgrades must be forwarded as-is.
    if (isWebSocketUpgrade(request)) {
      return stub.fetch(request);
    }

    // Forward the original request directly to preserve streaming body integrity.
    return stub.fetch(request);
  },

  async scheduled(_: ScheduledController, env: Bindings, ctx: ExecutionContext): Promise<void> {
    const id = env.API_APP.idFromName("primary");
    const stub = env.API_APP.get(id);
    const headers = new Headers();
    if (env.INTERNAL_API_TOKEN) {
      headers.set("x-internal-token", env.INTERNAL_API_TOKEN);
    }

    ctx.waitUntil(
      stub.fetch("https://internal/__internal/cleanup", {
        method: "POST",
        headers,
      }).catch((err) => {
        console.error("[Cron] Device cleanup failed:", err);
      })
    );
  },
};
