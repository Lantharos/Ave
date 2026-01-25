/**
 * Ave Service Worker
 * Handles push notifications for login requests
 */

self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Service worker activated");
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received");
  
  if (!event.data) {
    console.log("[SW] No data in push event");
    return;
  }
  
  try {
    const data = event.data.json();
    console.log("[SW] Push data:", data);
    
    const options = {
      body: data.body || "You have a new notification",
      icon: data.icon || "/icons/ave-icon-192.png",
      badge: data.badge || "/icons/ave-badge-72.png",
      tag: data.tag || "ave-notification",
      requireInteraction: data.requireInteraction || false,
      data: data.data || {},
      actions: data.actions || [],
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || "Ave", options)
    );
  } catch (e) {
    console.error("[SW] Error processing push:", e);
  }
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.action);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  let targetUrl = "/dashboard";
  
  // Handle different notification types
  if (data.type === "login_request") {
    targetUrl = data.url || `/dashboard/approve?requestId=${data.requestId}`;
  }
  
  // Handle action buttons
  if (event.action === "approve" || event.action === "deny") {
    targetUrl = `/dashboard/approve?requestId=${data.requestId}&action=${event.action}`;
  }
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          // Navigate existing window to the target URL
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      
      // Open a new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed");
});
