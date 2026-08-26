import { applyBookmark, captureBookmark } from "./bookmark-store";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
  publicRequest?: boolean;
};

type ApiClientOptions = {
  baseUrl: string;
  getAccessToken?: () => string | null;
  timeoutMs?: number;
};

function errorMessage(data: unknown, fallback = "Request failed"): string {
  if (!data || typeof data !== "object" || !("error" in data)) return fallback;
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  if (data.error && typeof data.error === "object" && "message" in data.error && typeof data.error.message === "string") {
    return data.error.message || fallback;
  }
  return fallback;
}

async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return {};
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export function createAveApiClient(options: ApiClientOptions) {
  async function raw(endpoint: string, requestOptions: ApiRequestOptions = {}): Promise<Response> {
    const { timeoutMs, publicRequest = false, ...fetchOptions } = requestOptions;
    const headers = new Headers(fetchOptions.headers);
    if (typeof fetchOptions.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (!publicRequest) {
      const token = options.getAccessToken?.();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      applyBookmark(headers);
    }

    const controller = fetchOptions.signal ? null : new AbortController();
    const signal = fetchOptions.signal || controller?.signal;
    const effectiveTimeout = timeoutMs ?? options.timeoutMs ?? 15_000;
    const timeout = controller && effectiveTimeout > 0
      ? globalThis.setTimeout(() => controller.abort(), effectiveTimeout)
      : null;

    let response: Response;
    try {
      response = await fetch(`${options.baseUrl}${endpoint}`, {
        ...fetchOptions,
        credentials: publicRequest ? "omit" : fetchOptions.credentials ?? "include",
        headers,
        signal,
      });
    } catch (error: unknown) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
        throw new ApiError(408, "Request timed out");
      }
      throw error;
    } finally {
      if (timeout !== null) globalThis.clearTimeout(timeout);
    }

    if (!publicRequest) captureBookmark(response);
    return response;
  }

  async function request<T>(endpoint: string, requestOptions: ApiRequestOptions = {}): Promise<T> {
    const response = await raw(endpoint, requestOptions);
    const data = await readResponse(response);
    if (!response.ok) throw new ApiError(response.status, errorMessage(data));
    return data as T;
  }

  function upload<T>(endpoint: string, formData: FormData, requestOptions: ApiRequestOptions = {}): Promise<T> {
    return request<T>(endpoint, { ...requestOptions, method: "POST", body: formData });
  }

  return { raw, request, upload };
}
