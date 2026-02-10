import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, identities, activityLogs } from "../db";
import { requireAuth } from "../middleware/auth";
import { eq, and } from "drizzle-orm";

const app = new Hono();

// All routes require authentication
app.use("*", requireAuth);

// Get all identities for current user
app.get("/", async (c) => {
  const user = c.get("user")!;
  
  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));
  
  return c.json({
    identities: userIdentities.map((i) => ({
      id: i.id,
      displayName: i.displayName,
      handle: i.handle,
      email: i.email,
      birthday: i.birthday,
      avatarUrl: i.avatarUrl,
      bannerUrl: i.bannerUrl,
      isPrimary: i.isPrimary,
      createdAt: i.createdAt,
    })),
  });
});

// Get single identity
app.get("/:identityId", async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }
  
  return c.json({
    identity: {
      id: identity.id,
      displayName: identity.displayName,
      handle: identity.handle,
      email: identity.email,
      birthday: identity.birthday,
      avatarUrl: identity.avatarUrl,
      bannerUrl: identity.bannerUrl,
      isPrimary: identity.isPrimary,
      createdAt: identity.createdAt,
    },
  });
});

// Create new identity
app.post("/", zValidator("json", z.object({
  displayName: z.string().min(1).max(64),
  handle: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email().optional(),
  birthday: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  // bannerUrl can be a URL or a hex color (e.g., #FF6B6B)
  bannerUrl: z.string().optional().refine(
    (val) => val === undefined || val.startsWith("#") || z.string().url().safeParse(val).success,
    { message: "Must be a valid URL or hex color" }
  ),
})), async (c) => {
  const user = c.get("user")!;
  const data = c.req.valid("json");
  
  // Check identity limit (5)
  const existingCount = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));
  
  if (existingCount.length >= 5) {
    return c.json({ error: "Maximum of 5 identities allowed" }, 400);
  }
  
  // Check handle availability
  const [existing] = await db
    .select()
    .from(identities)
    .where(eq(identities.handle, data.handle.toLowerCase()))
    .limit(1);
  
  if (existing) {
    return c.json({ error: "Handle is already taken" }, 400);
  }
  
  const [identity] = await db
    .insert(identities)
    .values({
      userId: user.id,
      displayName: data.displayName,
      handle: data.handle.toLowerCase(),
      email: data.email,
      birthday: data.birthday,
      avatarUrl: data.avatarUrl,
      bannerUrl: data.bannerUrl,
      isPrimary: existingCount.length === 0, // First identity is primary
    })
    .returning();
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "identity_created",
    details: { identityId: identity.id, handle: identity.handle },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });
  
  return c.json({
    identity: {
      id: identity.id,
      displayName: identity.displayName,
      handle: identity.handle,
      email: identity.email,
      birthday: identity.birthday,
      avatarUrl: identity.avatarUrl,
      bannerUrl: identity.bannerUrl,
      isPrimary: identity.isPrimary,
    },
  }, 201);
});

// Update identity
app.patch("/:identityId", zValidator("json", z.object({
  displayName: z.string().min(1).max(64).optional(),
  handle: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  email: z.string().email().nullable().optional(),
  birthday: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  // bannerUrl can be a URL or a hex color (e.g., #FF6B6B)
  bannerUrl: z.string().nullable().optional().refine(
    (val) => val === null || val === undefined || val.startsWith("#") || z.string().url().safeParse(val).success,
    { message: "Must be a valid URL or hex color" }
  ),
})), async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  const data = c.req.valid("json");
  
  // Verify identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }
  
  // If changing handle, check availability
  if (data.handle && data.handle.toLowerCase() !== identity.handle) {
    const [existing] = await db
      .select()
      .from(identities)
      .where(eq(identities.handle, data.handle.toLowerCase()))
      .limit(1);
    
    if (existing) {
      return c.json({ error: "Handle is already taken" }, 400);
    }
  }
  
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.handle !== undefined) updateData.handle = data.handle.toLowerCase();
  if (data.email !== undefined) updateData.email = data.email;
  if (data.birthday !== undefined) updateData.birthday = data.birthday;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
  if (data.bannerUrl !== undefined) updateData.bannerUrl = data.bannerUrl;
  
  const [updated] = await db
    .update(identities)
    .set(updateData)
    .where(eq(identities.id, identityId))
    .returning();
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "identity_updated",
    details: { identityId, changes: Object.keys(data) },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });
  
  return c.json({
    identity: {
      id: updated.id,
      displayName: updated.displayName,
      handle: updated.handle,
      email: updated.email,
      birthday: updated.birthday,
      avatarUrl: updated.avatarUrl,
      bannerUrl: updated.bannerUrl,
      isPrimary: updated.isPrimary,
    },
  });
});

// Set primary identity
app.post("/:identityId/set-primary", async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  
  // Verify identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }
  
  // Remove primary from all other identities
  await db
    .update(identities)
    .set({ isPrimary: false })
    .where(eq(identities.userId, user.id));
  
  // Set this one as primary
  await db
    .update(identities)
    .set({ isPrimary: true })
    .where(eq(identities.id, identityId));
  
  return c.json({ success: true });
});

// Delete identity
app.delete("/:identityId", async (c) => {
  const user = c.get("user")!;
  const identityId = c.req.param("identityId");
  
  // Verify identity belongs to user
  const [identity] = await db
    .select()
    .from(identities)
    .where(and(eq(identities.id, identityId), eq(identities.userId, user.id)))
    .limit(1);
  
  if (!identity) {
    return c.json({ error: "Identity not found" }, 404);
  }

  if (identity.isPrimary) {
    return c.json({ error: "Cannot delete primary identity. Set another identity as primary first." }, 400);
  }
  
  // Can't delete the only identity
  const allIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));
  
  if (allIdentities.length === 1) {
    return c.json({ error: "Cannot delete your only identity" }, 400);
  }
  
  await db.delete(identities).where(eq(identities.id, identityId));
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "identity_deleted",
    details: { identityId, handle: identity.handle },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });
  
  return c.json({ success: true });
});

export default app;
