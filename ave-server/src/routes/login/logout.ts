import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db, sessions } from "../../db";
import { hashSessionToken } from "../../lib/crypto";
import { clearSessionCookie, SESSION_COOKIE_NAME } from "../../lib/session-cookie";
import type { Bindings } from "./shared";

const app = new Hono<{ Bindings: Bindings }>();

app.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  const cookieHeader = c.req.header("Cookie") || "";
  const cookieToken = cookieHeader
    ? cookieHeader
        .split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith(`${SESSION_COOKIE_NAME}=`))
        ?.slice(`${SESSION_COOKIE_NAME}=`.length)
    : null;

  const token = bearerToken || (cookieToken ? decodeURIComponent(cookieToken) : null);

  if (token) {
    const tokenHash = hashSessionToken(token);
    await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  clearSessionCookie(c);
  c.header("Set-Login", "logged-out");
  return c.json({ success: true });
});

export default app;
