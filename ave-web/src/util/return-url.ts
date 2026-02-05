const STORAGE_KEY = "ave:return_url";

function isValidReturnUrl(value: string | null): value is string {
  if (!value) return false;
  // Only allow relative app paths
  if (!value.startsWith("/")) return false;
  // Never allow login as a return target
  if (value.startsWith("/login")) return false;
  return true;
}

export function setReturnUrl(pathWithSearch: string) {
  if (!isValidReturnUrl(pathWithSearch)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, pathWithSearch);
  } catch {
    // Ignore storage errors
  }
}

export function getReturnUrl(): string | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    return isValidReturnUrl(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearReturnUrl() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
