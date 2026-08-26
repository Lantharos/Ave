import { sendPushNotification, type HeavyServicesBinding, type PushSubscription } from "./heavy-services";

export type { PushSubscription } from "./heavy-services";

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendLoginRequestNotification(
  service: HeavyServicesBinding,
  subscription: PushSubscription,
  data: {
    requestId: string;
    deviceName: string;
    deviceType: string;
    browser?: string;
    os?: string;
    ipAddress?: string;
  },
): Promise<boolean> {
  return sendPushNotification(service, subscription, {
    title: "Login Request",
    body: `${data.deviceName} is trying to sign in to your Ave account`,
    icon: "/icon.png",
    badge: "/icon.png",
    tag: `login-request-${data.requestId}`,
    requireInteraction: true,
    data: { type: "login_request", requestId: data.requestId, url: `/dashboard?section=login-requests&requestId=${data.requestId}` },
    actions: [{ action: "approve", title: "Approve" }, { action: "deny", title: "Deny" }],
  });
}

export async function sendAccountEventNotification(
  service: HeavyServicesBinding,
  subscription: PushSubscription,
  data: { title: string; body: string; event: string; url?: string; details?: Record<string, unknown> },
): Promise<boolean> {
  return sendPushNotification(service, subscription, {
    title: data.title,
    body: data.body,
    icon: "/icon.png",
    badge: "/icon.png",
    tag: `account-event-${data.event}`,
    data: { type: "account_event", event: data.event, url: data.url || "/dashboard?section=activity", ...(data.details || {}) },
  });
}
