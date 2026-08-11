import { Context, Next } from "hono";
import { db, sessions, devices } from "../db";
import { eq, and, gt, lt } from "drizzle-orm";
import { hashSessionToken } from "../lib/crypto";
import { getCookieValue, SESSION_COOKIE_NAME, setSessionCookie } from "../lib/session-cookie";
import type { AccessTokenRecord } from "../lib/oauth-store";
import { runInBackground } from "../lib/background";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEVICE_LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

export type AuthUser = {
  id: string;
  deviceId: string | null;
  authMethod?: string | null;
  enterpriseSsoOrganizationId?: string | null;
  enterpriseSsoConnectionId?: string | null;
  isReadOnly: boolean;
};

// Extend Hono context with user
declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser | null;
    oauthAccess?: AccessTokenRecord | null;
  }
}

/**
 * Authentication middleware
 * Extracts and validates the session token from the Authorization header
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  const bearerValue = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const bearerToken = bearerValue && /^[0-9a-f]{64}$/i.test(bearerValue) ? bearerValue : null;

  const cookieHeader = c.req.header("Cookie") || "";
  const cookieToken = cookieHeader ? getCookieValue(cookieHeader, SESSION_COOKIE_NAME) : null;

  const token = bearerToken || cookieToken;

  if (!token) {
    c.set("user", null);
    return next();
  }

  const tokenHash = hashSessionToken(token);
  
  try {
    // Find valid session
    const [session] = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        deviceId: sessions.deviceId,
        expiresAt: sessions.expiresAt,
        authMethod: sessions.authMethod,
        enterpriseSsoOrganizationId: sessions.enterpriseSsoOrganizationId,
        enterpriseSsoConnectionId: sessions.enterpriseSsoConnectionId,
        deviceLastSeenAt: devices.lastSeenAt,
      })
      .from(sessions)
      .leftJoin(devices, eq(devices.id, sessions.deviceId))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);
    
    if (!session) {
      c.set("user", null);
      return next();
    }

    const refreshedExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
    if (new Date(session.expiresAt).getTime() - Date.now() < SESSION_REFRESH_WINDOW_MS) {
      await db
        .update(sessions)
        .set({ expiresAt: refreshedExpiresAt })
        .where(eq(sessions.id, session.id));

      setSessionCookie(c, token, refreshedExpiresAt);
    }
    
    // Update device last seen if we have a device
    const staleBefore = new Date(Date.now() - DEVICE_LAST_SEEN_UPDATE_INTERVAL_MS);
    if (session.deviceId && (!session.deviceLastSeenAt || session.deviceLastSeenAt < staleBefore)) {
      runInBackground(
        c,
        db
          .update(devices)
          .set({ lastSeenAt: new Date() })
          .where(and(eq(devices.id, session.deviceId), lt(devices.lastSeenAt, staleBefore))),
        "Device last-seen update",
      );
    }
    
    c.set("user", {
      id: session.userId,
      deviceId: session.deviceId,
      authMethod: session.authMethod,
      enterpriseSsoOrganizationId: session.enterpriseSsoOrganizationId,
      enterpriseSsoConnectionId: session.enterpriseSsoConnectionId,
      isReadOnly: session.authMethod === "demo",
    });
  } catch (error) {
    console.error("Auth middleware error:", error);
    c.set("user", null);
  }
  
  return next();
}

/**
 * Require authentication - returns 401 if not authenticated
 */
export async function requireAuth(c: Context, next: Next) {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  return next();
}

export async function requireWritable(c: Context, next: Next) {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (user.isReadOnly) {
    return c.json({ error: "Demo account is read-only" }, 403);
  }

  return next();
}

export async function requireWritableForMutation(c: Context, next: Next) {
  if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
    return next();
  }

  return requireWritable(c, next);
}
