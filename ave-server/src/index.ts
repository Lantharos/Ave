import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth";
import { 
  handleWebSocketOpen, 
  handleWebSocketClose, 
  handleWebSocketMessage 
} from "./lib/websocket";

// Routes
import registerRoutes from "./routes/register";
import loginRoutes from "./routes/login";
import devicesRoutes, { startDeviceCleanupJob } from "./routes/devices";
import identitiesRoutes from "./routes/identities";
import securityRoutes from "./routes/security";
import activityRoutes from "./routes/activity";
import mydataRoutes from "./routes/mydata";
import oauthRoutes, { oidcRoutes } from "./routes/oauth";
import appsRoutes from "./routes/apps";

import uploadRoutes from "./routes/upload";

const app = new Hono();

// Middleware
app.use("*", logger());

app.use("/api/oauth/*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.use("/.well-known/*", cors({
  origin: "*",
  allowMethods: ["GET", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));


app.use("*", async (c, next) => {
  if (c.req.path.startsWith("/api/oauth/")) {
    return next();
  }
  
  const corsMiddleware = cors({
    origin: (origin) => {
      if (origin && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
        return origin;
      }
      if (origin === "https://aveid.net" || origin === "https://devs.aveid.net") {
        return origin;
      }
      return process.env.RP_ORIGIN || "http://localhost:5173";
    },

    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  });
  
  return corsMiddleware(c, next);
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
app.route("/.well-known", oidcRoutes);
app.route("/api/upload", uploadRoutes);


// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Start server
const port = Number(process.env.PORT) || 3000;

console.log(`Ave API server starting on port ${port}...`);

// Bun server with WebSocket support
const server = Bun.serve({
  port,
  fetch(request, server) {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade for /ws path
    if (url.pathname === "/ws") {
      const authToken = url.searchParams.get("token") || undefined;
      const requestId = url.searchParams.get("requestId") || undefined;
      
      const upgraded = server.upgrade(request, {
        data: { authToken, requestId },
      });
      
      if (upgraded) {
        return undefined;
      }
      
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    
    // Handle all other requests with Hono
    return app.fetch(request);
  },
  websocket: {
    open(ws) {
      const data = (ws as any).data as { authToken?: string; requestId?: string };
      handleWebSocketOpen(ws, data);
    },
    close(ws) {
      handleWebSocketClose(ws);
    },
    message(ws, message) {
      const msg = typeof message === "string" ? message : message.toString();
      handleWebSocketMessage(ws, msg);
    },
  },
});

console.log(`Ave API server running at http://localhost:${server.port}`);

// Start background jobs
startDeviceCleanupJob();
