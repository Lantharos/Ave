import { buildPushPayload } from "@block65/webcrypto-web-push";

export type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  tag?: string;
  requireInteraction?: boolean;
};

export type PushDelivery = "sent" | "expired" | "disabled";

export async function sendPushNotification(subscription: PushSubscription, payload: PushPayload): Promise<PushDelivery> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return "disabled";
  const request = await buildPushPayload({
    data: JSON.stringify(payload),
    options: { ttl: 3600, urgency: "high" },
  }, { ...subscription, expirationTime: null }, {
    subject: process.env.VAPID_SUBJECT || "mailto:hello@lantharos.com",
    publicKey,
    privateKey,
  });
  const response = await fetch(subscription.endpoint, { ...request, signal: AbortSignal.timeout(10000) });
  await response.body?.cancel();
  if (response.status === 404 || response.status === 410) return "expired";
  if (!response.ok) throw new Error(`Push service returned ${response.status}`);
  return "sent";
}
