import Constants from "expo-constants";

export type DeviceType = "phone" | "computer" | "tablet";

export interface LoginRequest {
  id: string;
  deviceName?: string;
  deviceType?: DeviceType;
  browser?: string;
  os?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
  requesterPublicKey: string;
}

export interface Identity {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  isPrimary: boolean;
}

type RequestOptions = RequestInit & {
  token?: string | null;
};

const apiFromEnv =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  "https://api.aveid.net";

const API_BASE = apiFromEnv.replace(/\/$/, "");

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Network request failed. Check API URL and internet connection.");
  }

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data as T;
}

export const api = {
  loginStart: async (handle: string) =>
    request<{
      userId: string;
      identity: Identity;
      hasDevices: boolean;
      hasPasskeys: boolean;
    }>("/api/login/start", {
      method: "POST",
      body: JSON.stringify({ handle }),
    }),

  loginWithTrustCode: async (data: { handle: string; code: string }) =>
    request<{
      success: boolean;
      sessionToken: string;
      encryptedMasterKeyBackup?: string;
      identities: Identity[];
      device: { id: string; name: string; type: DeviceType };
    }>("/api/login/trust-code", {
      method: "POST",
      body: JSON.stringify({
        handle: data.handle,
        code: data.code,
        device: {
          name: "Ave Mobile",
          type: "phone",
          os: "mobile",
          browser: "expo",
        },
      }),
    }),

  requestApproval: async (data: {
    handle: string;
    requesterPublicKey: string;
  }) =>
    request<{
      requestId: string;
      expiresAt: string;
    }>("/api/login/request-approval", {
      method: "POST",
      body: JSON.stringify({
        handle: data.handle,
        requesterPublicKey: data.requesterPublicKey,
        device: {
          name: "Ave Mobile",
          type: "phone",
          os: "mobile",
          browser: "expo",
        },
      }),
    }),

  checkRequestStatus: async (requestId: string) =>
    request<{
      status: "pending" | "approved" | "denied" | "expired";
      sessionToken?: string;
      encryptedMasterKey?: string;
      approverPublicKey?: string;
      identities?: Identity[];
      device?: { id: string; name: string; type: DeviceType };
    }>(`/api/login/request-status/${requestId}`),

  getPendingRequests: async (token: string) =>
    request<{ requests: LoginRequest[] }>("/api/devices/pending-requests", {
      token,
    }),

  approveRequest: async (
    token: string,
    requestId: string,
    encryptedMasterKey: string,
    approverPublicKey: string
  ) =>
    request<{ success: boolean }>("/api/devices/approve-request", {
      method: "POST",
      token,
      body: JSON.stringify({
        requestId,
        encryptedMasterKey,
        approverPublicKey,
      }),
    }),

  denyRequest: async (token: string, requestId: string) =>
    request<{ success: boolean }>("/api/devices/deny-request", {
      method: "POST",
      token,
      body: JSON.stringify({ requestId }),
    }),

  listIdentities: async (token: string) =>
    request<{ identities: Identity[] }>("/api/identities", {
      token,
    }),
};
