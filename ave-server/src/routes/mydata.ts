import { and, eq, isNotNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { activityLogs, db, devices, identities, oauthApps, oauthAuthorizations, organizations, passkeys, sessions, trustCodes, users } from "../db";
import { recordActivityLog } from "../lib/background-events";
import { clearSessionCookie } from "../lib/session-cookie";
import { requireAuth, requireWritableForMutation } from "../middleware/auth";

const app = new Hono();

// All routes require authentication
app.use("*", requireAuth);
app.use("*", requireWritableForMutation);

// Download all user data (GDPR data export)
app.get("/export", async (c) => {
  const user = c.get("user")!;
  
  const [userRows, userIdentities, userPasskeys, userDevices, userSessions, userTrustCodes, userActivityLogs, userAuthorizations] = await Promise.all([
    db.select({ id: users.id, createdAt: users.createdAt, updatedAt: users.updatedAt })
      .from(users).where(eq(users.id, user.id)).limit(1),
    db.select({
      id: identities.id, displayName: identities.displayName, handle: identities.handle,
      email: identities.email, pendingEmail: identities.pendingEmail, birthday: identities.birthday,
      avatarUrl: identities.avatarUrl, bannerUrl: identities.bannerUrl, isPrimary: identities.isPrimary,
      createdAt: identities.createdAt,
    }).from(identities).where(eq(identities.userId, user.id)),
    db.select({
      id: passkeys.id, name: passkeys.name, deviceType: passkeys.deviceType,
      createdAt: passkeys.createdAt, lastUsedAt: passkeys.lastUsedAt,
    }).from(passkeys).where(eq(passkeys.userId, user.id)),
    db.select({
      id: devices.id, name: devices.name, type: devices.type, browser: devices.browser, os: devices.os,
      createdAt: devices.createdAt, lastSeenAt: devices.lastSeenAt, isActive: devices.isActive,
    }).from(devices).where(eq(devices.userId, user.id)),
    db.select({ id: sessions.id, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt, ipAddress: sessions.ipAddress })
      .from(sessions).where(eq(sessions.userId, user.id)),
    db.select({ id: trustCodes.id, createdAt: trustCodes.createdAt, usedAt: trustCodes.usedAt })
      .from(trustCodes).where(eq(trustCodes.userId, user.id)),
    db.select({
      id: activityLogs.id, action: activityLogs.action, details: activityLogs.details,
      severity: activityLogs.severity, ipAddress: activityLogs.ipAddress, createdAt: activityLogs.createdAt,
    }).from(activityLogs).where(eq(activityLogs.userId, user.id)),
    db.select({
      id: oauthAuthorizations.id, appId: oauthAuthorizations.appId,
      identityId: oauthAuthorizations.identityId, createdAt: oauthAuthorizations.createdAt,
    }).from(oauthAuthorizations).where(eq(oauthAuthorizations.userId, user.id)),
  ]);
  const [userData] = userRows;
  
  // Compile export data
  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: userData.id,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
    },
    identities: userIdentities,
    passkeys: userPasskeys,
    devices: userDevices,
    sessions: userSessions,
    trustCodes: userTrustCodes,
    activityLog: userActivityLogs,
    authorizedApps: userAuthorizations,
  };
  
  // Log activity
  recordActivityLog(c, {
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
  
  await db.batch([
    db.update(oauthApps)
      .set({ ownerId: sql`(select ${organizations.ownerUserId} from ${organizations} where ${organizations.id} = ${oauthApps.organizationId})` })
      .where(and(eq(oauthApps.ownerId, user.id), isNotNull(oauthApps.organizationId))),
    db.delete(oauthApps).where(eq(oauthApps.ownerId, user.id)),
    db.delete(users).where(eq(users.id, user.id)),
  ]);
  clearSessionCookie(c);
  c.header("Set-Login", "logged-out");

  return c.json({ 
    success: true,
    message: "Your Ave account records have been deleted. Data already copied by connected apps and cached public image copies may remain outside Ave's direct control.",
  });
});

export default app;
