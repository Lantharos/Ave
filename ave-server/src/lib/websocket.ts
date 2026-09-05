import { and, eq, gt } from "drizzle-orm";
import { db, primaryDb, identities, loginRequests, sessions } from "../db";
import { hashSessionToken } from "./crypto";

type SocketSession = { userId: string; sessionId: string; expiresAt: number };
const connectedClients = new Map<string, Set<WebSocket>>();
const authenticatedSockets = new WeakMap<WebSocket, SocketSession>();
const pendingSubscriptions = new WeakMap<WebSocket, { requestId: string; timeout: ReturnType<typeof setTimeout> }>();
const loginRequestSubscribers = new Map<string, Set<WebSocket>>();
const subscribedRequests = new WeakMap<WebSocket, { requestId: string; timeout: ReturnType<typeof setTimeout> }>();
const closedSockets = new WeakSet<WebSocket>();

function safeClose(socket: WebSocket, code: number, reason: string): void {
  handleWebSocketClose(socket);
  try { socket.close(code, reason); } catch { }
}

function safeSend(socket: WebSocket, payload: string): void {
  try { socket.send(payload); } catch { safeClose(socket, 1011, "Connection unavailable"); }
}

export async function handleWebSocketOpen(socket: WebSocket, data: { authToken?: string; requestId?: string }) {
  try {
    if (data.requestId) {
      const timeout = setTimeout(() => safeClose(socket, 1008, "Subscription authentication required"), 10000);
      pendingSubscriptions.set(socket, { requestId: data.requestId, timeout });
      return;
    }
    if (!data.authToken) {
      safeClose(socket, 1008, "Authentication required");
      return;
    }
    const [session] = await db.select({ id: sessions.id, userId: sessions.userId, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(and(eq(sessions.tokenHash, hashSessionToken(data.authToken)), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (closedSockets.has(socket)) return;
    if (!session) {
      safeClose(socket, 1008, "Invalid session");
      return;
    }
    const clients = connectedClients.get(session.userId) || new Set<WebSocket>();
    clients.add(socket);
    connectedClients.set(session.userId, clients);
    authenticatedSockets.set(socket, { userId: session.userId, sessionId: session.id, expiresAt: session.expiresAt.getTime() });
    safeSend(socket, JSON.stringify({ type: "connected" }));
  } catch {
    safeClose(socket, 1011, "Authentication error");
  }
}

export function handleWebSocketClose(socket: WebSocket) {
  closedSockets.add(socket);
  const session = authenticatedSockets.get(socket);
  if (session) {
    const clients = connectedClients.get(session.userId);
    clients?.delete(socket);
    if (clients?.size === 0) connectedClients.delete(session.userId);
    authenticatedSockets.delete(socket);
  }
  const pending = pendingSubscriptions.get(socket);
  if (pending) clearTimeout(pending.timeout);
  pendingSubscriptions.delete(socket);
  const subscription = subscribedRequests.get(socket);
  if (subscription) {
    clearTimeout(subscription.timeout);
    const { requestId } = subscription;
    const subscribers = loginRequestSubscribers.get(requestId);
    subscribers?.delete(socket);
    if (subscribers?.size === 0) loginRequestSubscribers.delete(requestId);
    subscribedRequests.delete(socket);
  }
}

async function refreshSocketSession(socket: WebSocket, session: SocketSession): Promise<boolean> {
  try {
    const [current] = await primaryDb.select({ expiresAt: sessions.expiresAt }).from(sessions)
      .where(and(eq(sessions.id, session.sessionId), eq(sessions.userId, session.userId), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (closedSockets.has(socket)) return false;
    if (!current) {
      safeClose(socket, 1008, "Session expired");
      return false;
    }
    session.expiresAt = current.expiresAt.getTime();
    return true;
  } catch {
    safeClose(socket, 1011, "Session unavailable");
    return false;
  }
}

export async function handleWebSocketMessage(socket: WebSocket, message: string) {
  if (message.length > 1024) {
    safeClose(socket, 1009, "Message too large");
    return;
  }
  try {
    const data = JSON.parse(message);
    const pending = pendingSubscriptions.get(socket);
    if (pending) {
      if (data.type !== "subscribe" || typeof data.requestToken !== "string" || !/^[a-f0-9]{64}$/.test(data.requestToken)) {
        safeClose(socket, 1008, "Invalid subscription");
        return;
      }
      pendingSubscriptions.delete(socket);
      clearTimeout(pending.timeout);
      const [request] = await db.select({ id: loginRequests.id, expiresAt: loginRequests.expiresAt }).from(loginRequests)
        .where(and(
          eq(loginRequests.id, pending.requestId),
          eq(loginRequests.requesterTokenHash, hashSessionToken(data.requestToken)),
          gt(loginRequests.expiresAt, new Date()),
        )).limit(1);
      if (closedSockets.has(socket)) return;
      if (!request) {
        safeClose(socket, 1008, "Invalid subscription");
        return;
      }
      const subscribers = loginRequestSubscribers.get(request.id) || new Set<WebSocket>();
      subscribers.add(socket);
      loginRequestSubscribers.set(request.id, subscribers);
      const timeout = setTimeout(() => safeClose(socket, 1000, "Request expired"), Math.max(0, request.expiresAt.getTime() - Date.now()));
      subscribedRequests.set(socket, { requestId: request.id, timeout });
      safeSend(socket, JSON.stringify({ type: "connected" }));
      return;
    }
    const session = authenticatedSockets.get(socket);
    if (session && session.expiresAt <= Date.now() && !(await refreshSocketSession(socket, session))) return;
    if (data.type === "ping" && (session || subscribedRequests.has(socket))) {
      safeSend(socket, JSON.stringify({ type: "pong" }));
    }
  } catch {
    safeClose(socket, 1008, "Invalid message");
  }
}

export async function notifyLoginRequest(handle: string, request: {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
}) {
  const [identity] = await db.select({ userId: identities.userId }).from(identities)
    .where(eq(identities.handle, handle)).limit(1);
  if (!identity) return;
  const clients = connectedClients.get(identity.userId);
  if (!clients?.size) return;
  const activeSessions = await db.select({ id: sessions.id }).from(sessions)
    .where(and(eq(sessions.userId, identity.userId), gt(sessions.expiresAt, new Date())));
  const activeSessionIds = new Set(activeSessions.map((session) => session.id));
  const message = JSON.stringify({ type: "login_request", request });
  for (const socket of clients) {
    const session = authenticatedSockets.get(socket);
    if (!session || !activeSessionIds.has(session.sessionId)) {
      safeClose(socket, 1008, "Session revoked");
    } else {
      safeSend(socket, message);
    }
  }
}

export function notifyLoginRequestStatus(requestId: string, status: "approved" | "denied") {
  const subscribers = loginRequestSubscribers.get(requestId);
  if (!subscribers) return;
  const message = JSON.stringify({ type: "login_request_status", status });
  for (const socket of subscribers) {
    safeSend(socket, message);
    safeClose(socket, 1000, "Request completed");
  }
}
