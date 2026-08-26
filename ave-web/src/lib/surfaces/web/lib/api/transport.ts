/**
 * API client for Ave backend
 */

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
export const D1_BOOKMARK_HEADER = "x-d1-bookmark";

let d1Bookmark: string | null = null;

export function readStoredBookmark(): string | null {
  if (d1Bookmark) return d1Bookmark;

  try {
    d1Bookmark = sessionStorage.getItem("ave_d1_bookmark");
  } catch {
    d1Bookmark = null;
  }

  return d1Bookmark;
}

export function persistBookmark(bookmark: string | null): void {
  d1Bookmark = bookmark;

  try {
    if (bookmark) {
      sessionStorage.setItem("ave_d1_bookmark", bookmark);
    } else {
      sessionStorage.removeItem("ave_d1_bookmark");
    }
  } catch {
  }
}

export function clearD1Bookmark(): void {
  persistBookmark(null);
}

export function mergeHeaders(
  base: HeadersInit | undefined,
  token: string | null,
  hasJsonBody: boolean,
  includeBookmark: boolean,
): Headers {
  const headers = new Headers(base);

  if (hasJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (includeBookmark) {
    const bookmark = readStoredBookmark();
    if (bookmark) {
      headers.set(D1_BOOKMARK_HEADER, bookmark);
    }
  }

  return headers;
}

export function captureBookmark(response: Response): void {
  const bookmark = response.headers.get(D1_BOOKMARK_HEADER);
  if (bookmark) {
    persistBookmark(bookmark);
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function request<T>(
  endpoint: string,
  options: (RequestInit & { timeoutMs?: number; publicRequest?: boolean }) = {}
): Promise<T> {
  const { timeoutMs, publicRequest = false, ...fetchOptions } = options;
  let token: string | null = null;
  if (!publicRequest) {
    try {
      token = localStorage.getItem("ave_session_token");
    } catch {
      token = null;
    }
  }

  const headers = mergeHeaders(fetchOptions.headers, token, typeof fetchOptions.body === "string", !publicRequest);
  let controller: AbortController | null = null;
  let timeoutId: number | null = null;
  let signal = fetchOptions.signal;

  if (!signal) {
    controller = new AbortController();
    signal = controller.signal;
  }

  const effectiveTimeout = timeoutMs ?? 15000;
  if (controller && effectiveTimeout > 0) {
    timeoutId = window.setTimeout(() => controller?.abort(), effectiveTimeout);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      credentials: publicRequest ? "omit" : fetchOptions.credentials ?? "include",
      headers,
      signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new ApiError(408, "Request timed out");
    }
    throw err;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }

  if (!publicRequest) {
    captureBookmark(response);
  }

  if (!publicRequest && response.status === 401) {
    clearD1Bookmark();
  }

  let data: unknown = {};
  const responseText = response.status === 204 ? "" : await response.text();
  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { error: responseText };
    }
  }

  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
      ? data.error
      : "Request failed";
    throw new ApiError(response.status, message);
  }

  return data as T;
}
