const STORAGE_KEY = "ave_dev_session";

export interface DevSession {
  accessTokenJwt: string;
  refreshToken?: string;
  clientId?: string;
}

export function loadSession(): DevSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DevSession;
  } catch {
    return null;
  }
}

export function saveSession(session: DevSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
