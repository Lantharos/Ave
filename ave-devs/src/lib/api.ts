const API_BASE = import.meta.env.VITE_API_URL || "https://api.aveid.net";

export interface DevApp {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  iconUrl?: string;
  redirectUris: string[];
  supportsE2ee: boolean;
  allowedScopes: string[];
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  allowUserIdScope: boolean;
  createdAt: string;
}

export interface CreateAppPayload {
  name: string;
  description?: string;
  websiteUrl?: string;
  iconUrl?: string;
  redirectUris: string[];
  supportsE2ee: boolean;
  allowedScopes: string[];
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
  allowUserIdScope?: boolean;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.error || "Request failed");
  }

  return data as T;
}

export async function fetchApps(): Promise<DevApp[]> {
  const data = await request<{ apps: DevApp[] }>("/api/apps");
  return data.apps;
}

export async function createApp(
  payload: CreateAppPayload,
): Promise<{ app: DevApp; clientSecret: string }> {
  return request("/api/apps", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateApp(
  appId: string,
  payload: Partial<CreateAppPayload>,
): Promise<{ app: DevApp }> {
  return request(`/api/apps/${appId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteApp(appId: string): Promise<{ success: boolean }> {
  return request(`/api/apps/${appId}`, {
    method: "DELETE",
  });
}

export async function rotateSecret(
  appId: string,
): Promise<{ clientSecret: string }> {
  return request(`/api/apps/${appId}/rotate-secret`, {
    method: "POST",
  });
}

export async function checkSession(): Promise<boolean> {
  try {
    await request<{ apps: DevApp[] }>("/api/apps");
    return true;
  } catch {
    return false;
  }
}

export { ApiError };
