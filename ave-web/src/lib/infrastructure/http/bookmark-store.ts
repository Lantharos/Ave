const BOOKMARK_HEADER = "x-d1-bookmark";
const BOOKMARK_STORAGE_KEY = "ave_d1_bookmark";

let currentBookmark: string | null = null;

export function readBookmark(): string | null {
  if (currentBookmark) return currentBookmark;
  try {
    currentBookmark = sessionStorage.getItem(BOOKMARK_STORAGE_KEY);
  } catch {
    currentBookmark = null;
  }
  return currentBookmark;
}

export function saveBookmark(value: string | null): void {
  currentBookmark = value;
  try {
    if (value) sessionStorage.setItem(BOOKMARK_STORAGE_KEY, value);
    else sessionStorage.removeItem(BOOKMARK_STORAGE_KEY);
  } catch {
  }
}

export function applyBookmark(headers: Headers): void {
  const bookmark = readBookmark();
  if (bookmark) headers.set(BOOKMARK_HEADER, bookmark);
}

export function captureBookmark(response: Response): void {
  const bookmark = response.headers.get(BOOKMARK_HEADER);
  if (bookmark) saveBookmark(bookmark);
  if (response.status === 401) saveBookmark(null);
}
