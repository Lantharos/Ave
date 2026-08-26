/**
 * Push Notifications utility for the Ave web app
 */

import { request } from "./api/transport";

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;

  // Push requires secure context (https or localhost).
  if (!window.isSecureContext) return false;

  // Some browsers don't expose PushManager on window; check SW registration prototype too.
  const hasPushManager =
    ("PushManager" in window) ||
    (typeof ServiceWorkerRegistration !== "undefined" && "pushManager" in ServiceWorkerRegistration.prototype);

  return "Notification" in window && "serviceWorker" in navigator && hasPushManager;
}

export function getPushSupportDetails(): {
  supported: boolean;
  secureContext: boolean;
  hasNotification: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
} {
  const secureContext = typeof window !== "undefined" ? window.isSecureContext : false;
  const hasNotification = typeof window !== "undefined" ? "Notification" in window : false;
  const hasServiceWorker = typeof navigator !== "undefined" ? "serviceWorker" in navigator : false;
  const hasPushManager =
    typeof window !== "undefined" &&
    (("PushManager" in window) ||
      (typeof ServiceWorkerRegistration !== "undefined" && "pushManager" in ServiceWorkerRegistration.prototype));

  const supported = secureContext && hasNotification && hasServiceWorker && hasPushManager;

  return {
    supported,
    secureContext,
    hasNotification,
    hasServiceWorker,
    hasPushManager,
  };
}

/**
 * Check if notifications are enabled
 */
export function isNotificationEnabled(): boolean {
  return Notification.permission === "granted";
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn("[Push] Push notifications not supported");
    return false;
  }
  
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

/**
 * Get the VAPID public key from the server
 */
async function getVapidPublicKey(): Promise<string | null> {
  try {
    const data = await request<{ enabled?: boolean; publicKey?: string }>("/api/push/vapid-key");
    
    if (!data.enabled || !data.publicKey) {
      return null;
    }
    
    return data.publicKey;
  } catch (e) {
    console.error("[Push] Failed to get VAPID key:", e);
    return null;
  }
}

/**
 * Convert a base64 string to Uint8Array (for applicationServerKey)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type ByteSource = ArrayBufferLike | ArrayBufferView;

function bytesFromBufferSource(source: ByteSource): Uint8Array {
  if (!ArrayBuffer.isView(source)) return new Uint8Array(source);
  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function bufferSourcesEqual(left: ByteSource, right: ByteSource): boolean {
  const leftBytes = bytesFromBufferSource(left);
  const rightBytes = bytesFromBufferSource(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;

  for (let index = 0; index < leftBytes.length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false;
  }

  return true;
}

function subscriptionUsesCurrentKey(subscription: PushSubscription, vapidPublicKey: string): boolean {
  const subscriptionKey = subscription.options.applicationServerKey;
  if (!subscriptionKey) return true;

  return bufferSourcesEqual(subscriptionKey, urlBase64ToUint8Array(vapidPublicKey));
}

async function getServiceWorkerRegistration(create: boolean): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  if (!create) return null;

  return navigator.serviceWorker.register("/sw.js");
}

async function saveSubscriptionToServer(subscription: PushSubscription): Promise<boolean> {
  try {
    await request<{ success: boolean }>("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({
      subscription: subscription.toJSON(),
    }),
    });
    return true;
  } catch {
    console.error("[Push] Failed to save subscription to server");
    return false;
  }
}

async function getServerPushStatus(): Promise<{ enabled: boolean; subscribed: boolean }> {
  try {
    const status = await request<{ enabled?: boolean; subscribed?: boolean }>("/api/push/status");
    return {
      enabled: !!status.enabled,
      subscribed: !!status.subscribed,
    };
  } catch {
    return { enabled: false, subscribed: false };
  }
}

async function getSyncedPushSubscription(vapidPublicKey: string, create: boolean): Promise<PushSubscription | null> {
  const registration = await getServiceWorkerRegistration(create);
  if (!registration) return null;
  if (create) await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  const hadSubscription = !!subscription;
  if (subscription && !subscriptionUsesCurrentKey(subscription, vapidPublicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription && (create || hadSubscription)) {
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  if (!subscription) return null;

  return await saveSubscriptionToServer(subscription) ? subscription : null;
}

/**
 * Register service worker and subscribe to push notifications
 */
export async function subscribeToPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn("[Push] Push notifications not supported");
    return false;
  }
  
  // Request permission first
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    return false;
  }
  
  const vapidPublicKey = await getVapidPublicKey();
  if (!vapidPublicKey) {
    return false;
  }
  
  try {
    return !!await getSyncedPushSubscription(vapidPublicKey, true);
  } catch (e) {
    console.error("[Push] Failed to subscribe:", e);
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushSupported()) {
    return true;
  }
  
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return true;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
    }

    await request<{ success: boolean }>("/api/push/unsubscribe", {
      method: "POST",
    });
    
    return true;
  } catch (e) {
    console.error("[Push] Failed to unsubscribe:", e);
    return false;
  }
}

/**
 * Check if currently subscribed to push notifications
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) {
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

/**
 * Get push notification status
 */
export async function getPushStatus(): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  const supported = getPushSupportDetails().supported;
  const permission = supported ? Notification.permission : "denied";
  if (!supported || permission !== "granted") {
    return {
      supported,
      permission,
      subscribed: false,
    };
  }

  const vapidPublicKey = await getVapidPublicKey();
  if (!vapidPublicKey) {
    return {
      supported,
      permission,
      subscribed: false,
    };
  }

  let subscribed = false;
  try {
    subscribed = !!await getSyncedPushSubscription(vapidPublicKey, false);
  } catch (error) {
    console.error("[Push] Failed to sync push status:", error);
    const [localSubscribed, serverStatus] = await Promise.all([
      isPushSubscribed(),
      getServerPushStatus(),
    ]);
    subscribed = localSubscribed && serverStatus.enabled && serverStatus.subscribed;
  }
  
  return {
    supported,
    permission,
    subscribed,
  };
}
