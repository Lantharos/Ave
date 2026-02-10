import { Hono } from "hono";
import { db, users, identities, passkeys, devices, sessions, trustCodes, activityLogs, oauthAuthorizations } from "../db";
import { requireAuth } from "../middleware/auth";
import { eq } from "drizzle-orm";

const app = new Hono();

// All routes require authentication
app.use("*", requireAuth);

// Download all user data (GDPR data export)
app.get("/export", async (c) => {
  const user = c.get("user")!;
  
  // Get all user's data
  const [userData] = await db
    .select({
      id: users.id,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  
  const userIdentities = await db
    .select({
      id: identities.id,
      displayName: identities.displayName,
      handle: identities.handle,
      email: identities.email,
      birthday: identities.birthday,
      avatarUrl: identities.avatarUrl,
      bannerUrl: identities.bannerUrl,
      isPrimary: identities.isPrimary,
      createdAt: identities.createdAt,
    })
    .from(identities)
    .where(eq(identities.userId, user.id));
  
  const userPasskeys = await db
    .select({
      id: passkeys.id,
      name: passkeys.name,
      deviceType: passkeys.deviceType,
      createdAt: passkeys.createdAt,
      lastUsedAt: passkeys.lastUsedAt,
    })
    .from(passkeys)
    .where(eq(passkeys.userId, user.id));
  
  const userDevices = await db
    .select({
      id: devices.id,
      name: devices.name,
      type: devices.type,
      browser: devices.browser,
      os: devices.os,
      createdAt: devices.createdAt,
      lastSeenAt: devices.lastSeenAt,
      isActive: devices.isActive,
    })
    .from(devices)
    .where(eq(devices.userId, user.id));
  
  const userSessions = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      ipAddress: sessions.ipAddress,
    })
    .from(sessions)
    .where(eq(sessions.userId, user.id));
  
  const userTrustCodes = await db
    .select({
      id: trustCodes.id,
      createdAt: trustCodes.createdAt,
      usedAt: trustCodes.usedAt,
    })
    .from(trustCodes)
    .where(eq(trustCodes.userId, user.id));
  
  const userActivityLogs = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      details: activityLogs.details,
      severity: activityLogs.severity,
      ipAddress: activityLogs.ipAddress,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .where(eq(activityLogs.userId, user.id));
  
  const userAuthorizations = await db
    .select({
      id: oauthAuthorizations.id,
      appId: oauthAuthorizations.appId,
      identityId: oauthAuthorizations.identityId,
      createdAt: oauthAuthorizations.createdAt,
    })
    .from(oauthAuthorizations)
    .where(eq(oauthAuthorizations.userId, user.id));
  
  // Compile export data
  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: userData.id,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
      hasSecurityQuestions: false,
    },
    identities: userIdentities,
    passkeys: userPasskeys,
    devices: userDevices,
    sessions: userSessions,
    trustCodes: userTrustCodes.map(tc => ({
      ...tc,
      // Don't expose actual codes, just metadata
    })),
    activityLog: userActivityLogs,
    authorizedApps: userAuthorizations,
  };
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "data_exported",
    details: {},
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });
  
  // Set headers for file download
  c.header("Content-Type", "application/json");
  c.header("Content-Disposition", `attachment; filename="ave-data-export-${new Date().toISOString().split("T")[0]}.json"`);
  
  return c.json(exportData);
});

// Delete all user data (account deletion)
app.delete("/", async (c) => {
  const user = c.get("user")!;
  
  // Log the deletion attempt first (will be deleted with user)
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "account_deleted",
    details: {},
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "danger",
  });
  
  // Delete user - cascade will delete all related data
  // (identities, passkeys, devices, sessions, trust codes, activity logs, oauth authorizations)
  await db.delete(users).where(eq(users.id, user.id));
  
  return c.json({ 
    success: true,
    message: "Your account and all associated data have been permanently deleted.",
  });
});

export default app;
