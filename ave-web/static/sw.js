/**
 * Ave Service Worker
 * Handles push notifications for login requests
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || "You have a new notification",
      icon: data.icon || "/icon.png",
      badge: data.badge || "/icon.png",
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
  event.notification.close();
  
  const data = event.notification.data || {};
  let targetUrl = data.url || "/dashboard";
  
  // Handle different notification types
  if (data.type === "login_request") {
    targetUrl = data.url || `/dashboard?section=login-requests&requestId=${data.requestId}`;
  }
  
  // Handle action buttons
  if (event.action === "approve" || event.action === "deny") {
    targetUrl = `/dashboard?section=login-requests&requestId=${data.requestId}&action=${event.action}`;
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
