import { resolveApiBase } from "$lib/infrastructure/http/origins";

function webSocketUrl(): URL {
  const configured = import.meta.env.VITE_WS_URL?.trim();
  const url = new URL(configured || `${resolveApiBase()}/ws`);
  url.protocol = url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
  return url;
}

export function watchLoginRequest(requestId: string, requestToken: string, onStatus: () => void): () => void {
  const url = webSocketUrl();
  url.searchParams.set("requestId", requestId);
  const socket = new WebSocket(url);
  socket.onopen = () => socket.send(JSON.stringify({ type: "subscribe", requestToken }));
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "login_request_status") onStatus();
    } catch { }
  };
  return () => {
    socket.onopen = null;
    socket.onmessage = null;
    socket.close();
  };
}

function createWebSocketStore() {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let reconnectDelay = 1000;
  const loginRequestHandlers = new Set<() => void>();

  function connectAsUser() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
    clearTimeout(reconnectTimer);
    const connection = new WebSocket(webSocketUrl());
    socket = connection;

    connection.onopen = () => {
      if (socket !== connection) return;
      reconnectDelay = 1000;
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ type: "ping" }));
      }, 30000);
    };
    connection.onmessage = (event) => {
      if (socket !== connection) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === "login_request") {
          for (const handler of loginRequestHandlers) handler();
        }
      } catch { }
    };
    connection.onclose = (event) => {
      if (socket !== connection) return;
      socket = null;
      clearInterval(pingTimer);
      if (event.code === 1008) return;
      reconnectTimer = setTimeout(connectAsUser, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    };
  }

  function disconnect() {
    clearTimeout(reconnectTimer);
    clearInterval(pingTimer);
    const connection = socket;
    socket = null;
    connection?.close();
  }

  return {
    connectAsUser,
    disconnect,
    onLoginRequest(handler: () => void) {
      loginRequestHandlers.add(handler);
      return () => { loginRequestHandlers.delete(handler); };
    },
  };
}

export const websocket = createWebSocketStore();
