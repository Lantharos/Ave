import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "../middleware/auth";
import activityRoutes from "../routes/account/activity";
import appsRoutes from "../routes/apps";
import devicesRoutes from "../routes/account/devices";
import encryptionRoutes from "../routes/account/encryption";
import identitiesRoutes from "../routes/account/identities";
import loginRoutes from "../routes/login";
import mydataRoutes from "../routes/account/mydata";
import oauthRoutes, { oidcRoutes } from "../routes/oauth";
import organizationsRoutes from "../routes/developer/organizations";
import pushRoutes from "../routes/account/push";
import registerRoutes from "../routes/account/register";
import securityRoutes from "../routes/account/security";
import uploadRoutes from "../routes/upload";
import type { Bindings } from "./bindings";
import { D1_BOOKMARK_HEADER } from "./request-database";
import { isAllowedOrigin, resolveCorsOrigin } from "./origins";
import { SESSION_COOKIE_NAME } from "../lib/auth/session-cookie";

function isCredentialedOAuthCorsPath(path: string): boolean {
  return path.startsWith("/api/oauth/authorize")
    || path === "/api/oauth/session/bootstrap"
    || path === "/api/oauth/authorizations"
    || path.startsWith("/api/oauth/authorization/")
    || path.startsWith("/api/oauth/authorizations/");
}

function isPublicApiCorsPath(path: string): boolean {
  return path.startsWith("/api/encryption/public-key/")
    || path === "/api/encryption/app-lookup";
}

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();

  app.use("*", async (c, next) => {
    await next();

    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

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
    maxAge: 86400,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", D1_BOOKMARK_HEADER],
    exposeHeaders: [D1_BOOKMARK_HEADER],
  });

  const oauthCorsMiddleware = cors({
    origin: (origin, c) => resolveCorsOrigin(origin, c.req.header("host")),
    credentials: true,
    maxAge: 86400,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", D1_BOOKMARK_HEADER],
    exposeHeaders: [D1_BOOKMARK_HEADER],
  });

  app.use("/api/oauth/*", async (c, next) => {
    if (isCredentialedOAuthCorsPath(c.req.path)) {
      return oauthCorsMiddleware(c, next);
    }
    return publicOAuthCorsMiddleware(c, next);
  });

  const publicApiCorsMiddleware = cors({
    origin: "*",
    credentials: false,
    maxAge: 86400,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", D1_BOOKMARK_HEADER],
    exposeHeaders: [D1_BOOKMARK_HEADER],
  });

  app.use("/.well-known/*", cors({
    origin: "*",
    credentials: false,
    maxAge: 86400,
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", D1_BOOKMARK_HEADER],
    exposeHeaders: [D1_BOOKMARK_HEADER],
  }));

  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/api/oauth/") || c.req.path.startsWith("/.well-known/")) {
      return next();
    }

    if (isPublicApiCorsPath(c.req.path)) {
      return publicApiCorsMiddleware(c, next);
    }

    const corsMiddleware = cors({
      origin: (origin, c) => resolveCorsOrigin(origin, c.req.header("host")),
      credentials: true,
      maxAge: 86400,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", D1_BOOKMARK_HEADER],
      exposeHeaders: [D1_BOOKMARK_HEADER],
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

    if (isAllowedOrigin(origin, c.req.header("host"))) {
      return next();
    }

    return c.json({ error: "origin_not_allowed" }, 403);
  });

  const jsonBodyLimit = bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) => c.json({ error: "Request body too large" }, 413),
  });
  const uploadBodyLimit = bodyLimit({
    maxSize: 12 * 1024 * 1024,
    onError: (c) => c.json({ error: "Upload too large" }, 413),
  });

  app.use("/api/*", (c, next) => (
    c.req.path.startsWith("/api/upload/")
      ? uploadBodyLimit(c, next)
      : jsonBodyLimit(c, next)
  ));

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
  app.route("/api/push", pushRoutes);
  app.route("/api/encryption", encryptionRoutes);
  app.route("/.well-known", oidcRoutes);
  app.route("/api/upload", uploadRoutes);

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: "Not Found" }, 404);
  });

  // Error handler
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
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

export const app = buildApp();
