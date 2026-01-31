import { Context, Next } from "hono";
import { db, sessions, devices, users } from "../db";
import { eq, and, gt } from "drizzle-orm";
import { hashSessionToken } from "../lib/crypto";
import { SESSION_COOKIE_NAME } from "../lib/session-cookie";

function getCookieValue(cookieHeader: string, name: string): string | null {
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    if (k === name) {
      const v = rest.join("=");
      return v ? decodeURIComponent(v) : "";
    }
  }
  return null;
}

export type AuthUser = {
  id: string;
  deviceId: string | null;
};

// Extend Hono context with user
declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser | null;
  }
}

/**
 * Authentication middleware
 * Extracts and validates the session token from the Authorization header
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

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
      .select()
      .from(sessions)
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
    
    // Update device last seen if we have a device
    if (session.deviceId) {
      await db
        .update(devices)
        .set({ lastSeenAt: new Date() })
        .where(eq(devices.id, session.deviceId));
    }
    
    c.set("user", {
      id: session.userId,
      deviceId: session.deviceId,
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
