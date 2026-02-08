/**
 * WebSocket store for real-time communication
 */

import { writable, get } from "svelte/store";
import type { LoginRequest } from "../lib/api";

const WS_URL = import.meta.env.VITE_WS_URL || "wss://api.aveid.net/ws";

interface WebSocketState {
  connected: boolean;
  pendingLoginRequests: LoginRequest[];
}

function createWebSocketStore() {
  const { subscribe, set, update } = writable<WebSocketState>({
    connected: false,
    pendingLoginRequests: [],
  });
  
  let ws: WebSocket | null = null;
  let reconnectTimeout: number | null = null;
  let pingInterval: number | null = null;
  
  // Event handlers that can be registered
  const eventHandlers: {
    loginRequest?: (request: LoginRequest) => void;
    loginRequestStatus?: (data: { status: string; [key: string]: any }) => void;
  } = {};
  
  function connect(token?: string, requestId?: string) {
    if (ws?.readyState === WebSocket.OPEN) {
      return;
    }
    
    const params = new URLSearchParams();
    if (token) params.set("token", token);
    if (requestId) params.set("requestId", requestId);
    
    const url = `${WS_URL}?${params.toString()}`;
    ws = new WebSocket(url);
    
    ws.onopen = () => {
      update((s) => ({ ...s, connected: true }));
      
      // Start ping interval
      pingInterval = window.setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };
    
    ws.onclose = () => {
      update((s) => ({ ...s, connected: false }));
      
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      
      // Reconnect after 5 seconds (only if we had a token)
      if (token && !reconnectTimeout) {
        reconnectTimeout = window.setTimeout(() => {
          reconnectTimeout = null;
          connect(token);
        }, 5000);
      }
    };
    
    ws.onerror = (error) => {
      // Only log in development, suppress in production
      if (import.meta.env.DEV) {
        console.warn("WebSocket connection failed (this is normal if not logged in)");
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case "connected":
            console.log("WebSocket connected");
            break;
          
          case "pong":
            // Ping response, ignore
            break;
          
          case "login_request":
            // New login request from another device
            update((s) => ({
              ...s,
              pendingLoginRequests: [...s.pendingLoginRequests, data.request],
            }));
            eventHandlers.loginRequest?.(data.request);
            break;
          
          case "login_request_status":
            // Login request status update (for the requesting device)
            eventHandlers.loginRequestStatus?.(data);
            break;
          
          default:
            console.log("Unknown WebSocket message:", data);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };
  }
  
  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    
    if (ws) {
      ws.close();
      ws = null;
    }
    
    set({ connected: false, pendingLoginRequests: [] });
  }
  
  return {
    subscribe,
    
    /**
     * Connect as an authenticated user (to receive login requests)
     */
    connectAsUser(token: string) {
      connect(token);
    },
    
    /**
     * Connect to subscribe to a login request status
     */
    subscribeToLoginRequest(requestId: string) {
      connect(undefined, requestId);
    },
    
    /**
     * Disconnect
     */
    disconnect,
    
    /**
     * Remove a login request from the list
     */
    removeLoginRequest(requestId: string) {
      update((s) => ({
        ...s,
        pendingLoginRequests: s.pendingLoginRequests.filter((r) => r.id !== requestId),
      }));
    },
    
    /**
     * Register event handler for login requests
     */
    onLoginRequest(handler: (request: LoginRequest) => void) {
      eventHandlers.loginRequest = handler;
    },
    
    /**
     * Register event handler for login request status updates
     */
    onLoginRequestStatus(handler: (data: { status: string; [key: string]: any }) => void) {
      eventHandlers.loginRequestStatus = handler;
    },
    
    /**
     * Clear event handlers
     */
    clearHandlers() {
      delete eventHandlers.loginRequest;
      delete eventHandlers.loginRequestStatus;
    },
  };
}

export const websocket = createWebSocketStore();
