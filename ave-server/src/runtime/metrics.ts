import type { Bindings } from "./bindings";
import { D1_BOOKMARK_HEADER, isWebSocketUpgrade } from "./request-database";

function normalizeMetricPath(path: string): string {
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":uuid")
    .replace(/app_[a-z0-9]+/gi, "app_:id")
    .replace(/org_[a-z0-9]+/gi, "org_:id")
    .replace(/\/[A-Za-z0-9_-]{24,}(?=\/|$)/g, "/:id");
}

function appendResponseMetadata(response: Response, durationMs: number, bookmark?: string | null): Response {
  const headers = new Headers(response.headers);
  headers.append("Server-Timing", `app;dur=${durationMs.toFixed(1)}`);
  if (bookmark) {
    headers.set(D1_BOOKMARK_HEADER, bookmark);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function recordRequestMetric(env: Bindings, request: Request, response: Response, durationMs: number): void {
  const analytics = env.API_ANALYTICS;
  if (!analytics) return;

  const url = new URL(request.url);
  const cf = (request as unknown as { cf?: { colo?: string; country?: string } }).cf;
  analytics.writeDataPoint({
    blobs: [
      request.method,
      normalizeMetricPath(url.pathname),
      String(response.status),
      cf?.colo || "unknown",
      cf?.country || "unknown",
    ],
    doubles: [durationMs],
    indexes: [url.hostname],
  });
}

export async function finalizeMeasuredResponse(
  env: Bindings,
  request: Request,
  startedAt: number,
  response: Response,
  requestDatabase?: D1DatabaseSession,
): Promise<Response> {
  if (isWebSocketUpgrade(request) || response.status === 101) {
    recordRequestMetric(env, request, response, performance.now() - startedAt);
    return response;
  }

  const durationMs = performance.now() - startedAt;
  const finalResponse = appendResponseMetadata(response, durationMs, requestDatabase?.getBookmark());
  recordRequestMetric(env, request, finalResponse, durationMs);
  return finalResponse;
}
