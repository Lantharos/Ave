import { ApiError, createAveApiClient } from "$lib/infrastructure/http/ave-api-client";
import { saveBookmark } from "$lib/infrastructure/http/bookmark-store";
import { resolveApiBase } from "$lib/infrastructure/http/origins";

export const API_BASE = resolveApiBase();

const client = createAveApiClient({
  baseUrl: API_BASE,
});

export const request = client.request;
export const rawRequest = client.raw;
export const upload = client.upload;
export function clearD1Bookmark() {
  saveBookmark(null);
}
export { ApiError };
