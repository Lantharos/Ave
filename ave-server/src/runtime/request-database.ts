export const D1_BOOKMARK_HEADER = "x-d1-bookmark";

export function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get("Upgrade")?.toLowerCase() === "websocket";
}

export function createRequestDatabase(request: Request, db: D1Database): D1DatabaseSession {
  const incomingBookmark = request.headers.get(D1_BOOKMARK_HEADER) || undefined;
  if (incomingBookmark) {
    return db.withSession(incomingBookmark);
  }

  if (isWebSocketUpgrade(request)) {
    return db.withSession("first-primary");
  }

  if (request.method === "GET" || request.method === "HEAD") {
    return db.withSession("first-unconstrained");
  }

  return db.withSession("first-primary");
}
