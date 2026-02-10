/**
 * WebSocket handler for real-time communication
 * Used for:
 * - Login request notifications to trusted devices
 * - Login approval status updates to requesting device
 */

import { db, sessions, identities } from "../db";
import { eq, and, gt } from "drizzle-orm";
import { hashSessionToken } from "./crypto";

// Store connected clients by user ID
const connectedClients = new Map<string, Set<WebSocket>>();

// Store login request subscribers (requestId -> WebSocket)
const loginRequestSubscribers = new Map<string, WebSocket>();

function safeClose(ws: WebSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason);
  } catch (error) {
    console.warn("WebSocket close failed:", error);
  }
}

function safeSend(ws: WebSocket, payload: string): void {
  try {
    ws.send(payload);
  } catch (error) {
    console.warn("WebSocket send failed:", error);
  }
}

export async function handleWebSocketOpen(ws: WebSocket, data: { authToken?: string; requestId?: string }) {
  try {
    // If subscribing to a login request (for the requesting device)
    if (data.requestId) {
      loginRequestSubscribers.set(data.requestId, ws);
      return;
    }

    // Otherwise, authenticate the user
    if (!data.authToken) {
      safeClose(ws, 1008, "Authentication required");
      return;
    }

    const tokenHash = hashSessionToken(data.authToken);

    const [session] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);
    
    if (!session) {
      safeClose(ws, 1008, "Invalid session");
      return;
    }
    
    // Add to connected clients
    if (!connectedClients.has(session.userId)) {
      connectedClients.set(session.userId, new Set());
    }
    connectedClients.get(session.userId)!.add(ws);
    
    // Store user ID on the websocket for cleanup
    (ws as any).userId = session.userId;
    
    // Send connected confirmation
    safeSend(ws, JSON.stringify({ type: "connected" }));
  } catch (error) {
    console.error("WebSocket auth error:", error);
    safeClose(ws, 1011, "Authentication error");
  }
}

export function handleWebSocketClose(ws: WebSocket) {
  const userId = (ws as any).userId;
  if (userId) {
    const userSockets = connectedClients.get(userId);
    if (userSockets) {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        connectedClients.delete(userId);
      }
    }
  }
  
  // Clean up any login request subscriptions
  for (const [requestId, socket] of loginRequestSubscribers.entries()) {
    if (socket === ws) {
      loginRequestSubscribers.delete(requestId);
      break;
    }
  }
}

export async function handleWebSocketMessage(ws: WebSocket, message: string) {
  try {
    const data = JSON.parse(message);
    
    switch (data.type) {
      case "ping":
        safeSend(ws, JSON.stringify({ type: "pong" }));
        break;
      
      default:
        console.log("Unknown message type:", data.type);
    }
  } catch (error) {
    console.error("WebSocket message error:", error);
  }
}

// Notify user's devices about a new login request
export async function notifyLoginRequest(handle: string, request: {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
}) {
  // Find user by handle
  const [identity] = await db
    .select()
    .from(identities)
    .where(eq(identities.handle, handle))
    .limit(1);
  
  if (!identity) return;
  
  const userSockets = connectedClients.get(identity.userId);
  if (!userSockets || userSockets.size === 0) return;
  
  const message = JSON.stringify({
    type: "login_request",
    request,
  });
  
  for (const socket of userSockets) {
    try {
      safeSend(socket, message);
    } catch (error) {
      console.error("Failed to send login request notification:", error);
    }
  }
}

// Notify the requesting device about login approval/denial
export function notifyLoginRequestStatus(requestId: string, status: "approved" | "denied", data?: {
  sessionToken?: string;
  encryptedMasterKey?: string;
  approverPublicKey?: string;
  identities?: any[];
  device?: any;
}) {

  const socket = loginRequestSubscribers.get(requestId);
  if (!socket) return;
  
  try {
    safeSend(socket, JSON.stringify({
      type: "login_request_status",
      status,
      ...data,
    }));
    
    // Clean up after sending
    loginRequestSubscribers.delete(requestId);
  } catch (error) {
    console.error("Failed to send login status notification:", error);
  }
}

// Check if a user has connected devices (for showing "confirm on device" option)
export function hasConnectedDevices(userId: string): boolean {
  const sockets = connectedClients.get(userId);
  return sockets !== undefined && sockets.size > 0;
}
