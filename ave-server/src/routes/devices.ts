import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, devices, loginRequests, sessions, activityLogs } from "../db";
import { requireAuth } from "../middleware/auth";
import { eq, and, desc, lt } from "drizzle-orm";
import { notifyLoginRequestStatus } from "../lib/websocket";

const app = new Hono();

// All routes require authentication
app.use("*", requireAuth);

// Get all devices for current user
app.get("/", async (c) => {
  const user = c.get("user")!;
  
  const userDevices = await db
    .select()
    .from(devices)
    .where(eq(devices.userId, user.id))
    .orderBy(desc(devices.lastSeenAt));
  
  return c.json({
    devices: userDevices.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      browser: d.browser,
      os: d.os,
      lastSeenAt: d.lastSeenAt,
      isActive: d.isActive,
      isCurrent: d.id === user.deviceId,
    })),
  });
});

// Get pending login requests (for approval from trusted device)
app.get("/pending-requests", async (c) => {
  const user = c.get("user")!;
  
  // Get user's handle to find their login requests
  const userDevices = await db
    .select()
    .from(devices)
    .where(eq(devices.userId, user.id))
    .limit(1);
  
  if (userDevices.length === 0) {
    return c.json({ requests: [] });
  }
  
  // Find pending login requests for this user
  // We need to join through identities to get the user's handles
  const { identities } = await import("../db");
  
  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));
  
  const handles = userIdentities.map((i) => i.handle);
  
  // Get pending requests for any of user's handles
  const pendingRequests = await db
    .select()
    .from(loginRequests)
    .where(and(
      eq(loginRequests.status, "pending"),
    ))
    .orderBy(desc(loginRequests.createdAt));
  
  // Filter to only this user's handles
  const userRequests = pendingRequests.filter((r) => handles.includes(r.handle));
  
  return c.json({
    requests: userRequests.map((r) => ({
      id: r.id,
      deviceName: r.deviceName,
      deviceType: r.deviceType,
      browser: r.browser,
      os: r.os,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      requesterPublicKey: r.requesterPublicKey,
    })),
  });
});

// Approve login request (send encrypted master key to requesting device)
app.post("/approve-request", zValidator("json", z.object({
  requestId: z.string().uuid(),
  encryptedMasterKey: z.string(), // Master key encrypted with requester's public key
  approverPublicKey: z.string(), // Approver's ephemeral public key
})), async (c) => {
  const user = c.get("user")!;
  const { requestId, encryptedMasterKey, approverPublicKey } = c.req.valid("json");

  
  // Find the request
  const [request] = await db
    .select()
    .from(loginRequests)
    .where(eq(loginRequests.id, requestId))
    .limit(1);
  
  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }
  
  if (request.status !== "pending") {
    return c.json({ error: "Request already handled" }, 400);
  }
  
  if (new Date() > request.expiresAt) {
    return c.json({ error: "Request expired" }, 400);
  }
  
  // Verify this request is for the current user
  const { identities } = await import("../db");
  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));
  
  const handles = userIdentities.map((i) => i.handle);
  if (!handles.includes(request.handle)) {
    return c.json({ error: "Unauthorized" }, 403);
  }
  
  // Update request with encrypted master key
  await db
    .update(loginRequests)
    .set({
      status: "approved",
      encryptedMasterKey,
      approvedByDeviceId: user.deviceId,
      approverPublicKey,
    })
    .where(eq(loginRequests.id, requestId));

  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "login_approved",
    details: { 
      requestId,
      deviceName: request.deviceName,
      deviceType: request.deviceType,
    },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "info",
  });
  
  // Notify the requesting device via WebSocket
  notifyLoginRequestStatus(requestId, "approved", {
    encryptedMasterKey,
    approverPublicKey,
  });

  
  return c.json({ success: true });
});

// Deny login request
app.post("/deny-request", zValidator("json", z.object({
  requestId: z.string().uuid(),
})), async (c) => {
  const user = c.get("user")!;
  const { requestId } = c.req.valid("json");
  
  // Find the request
  const [request] = await db
    .select()
    .from(loginRequests)
    .where(eq(loginRequests.id, requestId))
    .limit(1);
  
  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }
  
  // Verify this request is for the current user
  const { identities } = await import("../db");
  const userIdentities = await db
    .select()
    .from(identities)
    .where(eq(identities.userId, user.id));
  
  const handles = userIdentities.map((i) => i.handle);
  if (!handles.includes(request.handle)) {
    return c.json({ error: "Unauthorized" }, 403);
  }
  
  // Update request status
  await db
    .update(loginRequests)
    .set({ status: "denied" })
    .where(eq(loginRequests.id, requestId));
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "login_denied",
    details: { 
      requestId,
      deviceName: request.deviceName,
      deviceType: request.deviceType,
    },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });
  
  // Notify the requesting device via WebSocket
  notifyLoginRequestStatus(requestId, "denied");
  
  return c.json({ success: true });
});

// Update device name
app.patch("/:deviceId", zValidator("json", z.object({
  name: z.string().min(1).max(64),
})), async (c) => {
  const user = c.get("user")!;
  const deviceId = c.req.param("deviceId");
  const { name } = c.req.valid("json");
  
  // Verify device belongs to user
  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.userId, user.id)))
    .limit(1);
  
  if (!device) {
    return c.json({ error: "Device not found" }, 404);
  }
  
  await db
    .update(devices)
    .set({ name })
    .where(eq(devices.id, deviceId));
  
  return c.json({ success: true });
});

// Revoke device (remove from trusted devices)
app.delete("/:deviceId", async (c) => {
  const user = c.get("user")!;
  const deviceId = c.req.param("deviceId");
  
  // Can't revoke current device
  if (deviceId === user.deviceId) {
    return c.json({ error: "Cannot revoke current device" }, 400);
  }
  
  // Verify device belongs to user
  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.userId, user.id)))
    .limit(1);
  
  if (!device) {
    return c.json({ error: "Device not found" }, 404);
  }
  
  // Delete all sessions for this device
  await db.delete(sessions).where(eq(sessions.deviceId, deviceId));
  
  // Mark device as inactive (or delete it)
  await db
    .update(devices)
    .set({ isActive: false })
    .where(eq(devices.id, deviceId));
  
  // Log activity
  await db.insert(activityLogs).values({
    userId: user.id,
    action: "device_removed",
    details: { deviceId, deviceName: device.name, deviceType: device.type },
    deviceId: user.deviceId,
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    severity: "warning",
  });
  
  return c.json({ success: true });
});

// Cleanup stale devices (not seen for over 14 days)
// This should be called periodically (e.g., daily cron job)
export async function cleanupStaleDevices() {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  
  // Get all stale devices
  const staleDevices = await db
    .select()
    .from(devices)
    .where(lt(devices.lastSeenAt, fourteenDaysAgo));
  
  if (staleDevices.length === 0) {
    console.log("[Cleanup] No stale devices found");
    return { removed: 0 };
  }
  
  console.log(`[Cleanup] Found ${staleDevices.length} stale devices to remove`);
  
  // For each stale device, delete sessions and mark as inactive
  for (const device of staleDevices) {
    // Delete all sessions for this device
    await db.delete(sessions).where(eq(sessions.deviceId, device.id));
    
    // Mark device as inactive (soft delete)
    await db
      .update(devices)
      .set({ isActive: false })
      .where(eq(devices.id, device.id));
    
    // Log activity
    await db.insert(activityLogs).values({
      userId: device.userId,
      action: "device_auto_removed",
      details: { 
        deviceId: device.id, 
        deviceName: device.name,
        lastSeenAt: device.lastSeenAt,
        reason: "inactive_14_days" 
      },
      severity: "info",
    });
  }
  
  console.log(`[Cleanup] Removed ${staleDevices.length} stale devices`);
  return { removed: staleDevices.length };
}

export default app;
