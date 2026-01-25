/**
 * Push Notifications utility for the Ave web app
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
    const response = await fetch(`${API_BASE}/api/push/vapid-key`);
    const data = await response.json();
    
    if (!data.enabled || !data.publicKey) {
      console.log("[Push] Push notifications not configured on server");
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
    console.log("[Push] Notification permission denied");
    return false;
  }
  
  // Get VAPID public key
  const vapidPublicKey = await getVapidPublicKey();
  if (!vapidPublicKey) {
    console.log("[Push] No VAPID key available");
    return false;
  }
  
  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js");
    console.log("[Push] Service worker registered");
    
    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    
    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    
    console.log("[Push] Push subscription created");
    
    // Send subscription to server
    const token = localStorage.getItem("ave_session_token");
    const response = await fetch(`${API_BASE}/api/push/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
      }),
    });
    
    if (!response.ok) {
      console.error("[Push] Failed to save subscription to server");
      return false;
    }
    
    console.log("[Push] Push subscription saved to server");
    return true;
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
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      console.log("[Push] Unsubscribed from push notifications");
    }
    
    // Notify server
    const token = localStorage.getItem("ave_session_token");
    await fetch(`${API_BASE}/api/push/unsubscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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
    const registration = await navigator.serviceWorker.ready;
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
  const supported = isPushSupported();
  const permission = supported ? Notification.permission : "denied";
  const subscribed = supported ? await isPushSubscribed() : false;
  
  return {
    supported,
    permission,
    subscribed,
  };
}
