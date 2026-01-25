import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, devices } from "../db";
import { requireAuth } from "../middleware/auth";
import { eq } from "drizzle-orm";
import { getVapidPublicKey, isPushConfigured } from "../lib/webpush";

const app = new Hono();

// Public endpoint to get VAPID public key
app.get("/vapid-key", (c) => {
  const publicKey = getVapidPublicKey();
  
  if (!publicKey) {
    return c.json({ 
      enabled: false, 
      message: "Push notifications not configured" 
    });
  }
  
  return c.json({ 
    enabled: true, 
    publicKey 
  });
});

// Protected routes
app.use("/*", requireAuth);

// Subscribe to push notifications
app.post("/subscribe", zValidator("json", z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
})), async (c) => {
  const user = c.get("user")!;
  const { subscription } = c.req.valid("json");
  
  if (!isPushConfigured()) {
    return c.json({ error: "Push notifications not configured" }, 503);
  }
  
  // Update device with push subscription
  if (user.deviceId) {
    await db
      .update(devices)
      .set({ pushSubscription: subscription })
      .where(eq(devices.id, user.deviceId));
    
    console.log(`[Push] Subscription saved for device ${user.deviceId}`);
  }
  
  return c.json({ success: true });
});

// Unsubscribe from push notifications
app.post("/unsubscribe", async (c) => {
  const user = c.get("user")!;
  
  // Remove push subscription from device
  if (user.deviceId) {
    await db
      .update(devices)
      .set({ pushSubscription: null })
      .where(eq(devices.id, user.deviceId));
    
    console.log(`[Push] Subscription removed for device ${user.deviceId}`);
  }
  
  return c.json({ success: true });
});

// Get push notification status for current device
app.get("/status", async (c) => {
  const user = c.get("user")!;
  
  if (!user.deviceId) {
    return c.json({ subscribed: false, enabled: isPushConfigured() });
  }
  
  const [device] = await db
    .select()
    .from(devices)
    .where(eq(devices.id, user.deviceId))
    .limit(1);
  
  return c.json({ 
    subscribed: !!device?.pushSubscription,
    enabled: isPushConfigured(),
  });
});

export default app;
