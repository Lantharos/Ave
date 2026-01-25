/**
 * Web Push Notifications utility
 * Uses the web-push library for VAPID authentication
 */

import webpush from "web-push";

// VAPID keys should be stored in environment variables
// Generate them once with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@aveid.net";

// Configure web-push if keys are available
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("[WebPush] Configured with VAPID keys");
} else {
  console.warn("[WebPush] VAPID keys not configured - push notifications disabled");
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * Get the public VAPID key for client subscription
 */
export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

/**
 * Check if push notifications are configured
 */
export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

/**
 * Send a push notification to a subscription
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!isPushConfigured()) {
    console.warn("[WebPush] Cannot send notification - VAPID not configured");
    return false;
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      {
        TTL: 60 * 60, // 1 hour TTL
        urgency: "high",
      }
    );
    console.log("[WebPush] Notification sent successfully");
    return true;
  } catch (error: any) {
    // Handle subscription expiration (410 Gone) or invalid subscription (404)
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log("[WebPush] Subscription expired or invalid:", error.statusCode);
      return false;
    }
    console.error("[WebPush] Failed to send notification:", error);
    return false;
  }
}

/**
 * Send login approval request notification
 */
export async function sendLoginRequestNotification(
  subscription: PushSubscription,
  data: {
    requestId: string;
    deviceName: string;
    deviceType: string;
    browser?: string;
    os?: string;
    ipAddress?: string;
  }
): Promise<boolean> {
  return sendPushNotification(subscription, {
    title: "Login Request",
    body: `${data.deviceName} is trying to sign in to your Ave account`,
    icon: "/icons/ave-icon-192.png",
    badge: "/icons/ave-badge-72.png",
    tag: `login-request-${data.requestId}`,
    requireInteraction: true,
    data: {
      type: "login_request",
      requestId: data.requestId,
      url: `/dashboard/approve?requestId=${data.requestId}`,
    },
    actions: [
      {
        action: "approve",
        title: "Approve",
      },
      {
        action: "deny",
        title: "Deny",
      },
    ],
  });
}
