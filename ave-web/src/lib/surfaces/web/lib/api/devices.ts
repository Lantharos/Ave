import { request } from "./transport";
import type { Device, LoginRequest } from "./types";

export const devicesApi = {
    list: () =>
      request<{ devices: Device[] }>("/api/devices"),

    getPendingRequests: () =>
      request<{ requests: LoginRequest[] }>("/api/devices/pending-requests"),

    approveRequest: (requestId: string, encryptedMasterKey: string, approverPublicKey?: string) =>
      request<{ success: boolean }>("/api/devices/approve-request", {
        method: "POST",
        body: JSON.stringify({ requestId, encryptedMasterKey, approverPublicKey }),
      }),


    denyRequest: (requestId: string) =>
      request<{ success: boolean }>("/api/devices/deny-request", {
        method: "POST",
        body: JSON.stringify({ requestId }),
      }),

    revoke: (deviceId: string) =>
      request<{ success: boolean }>(`/api/devices/${deviceId}`, {
        method: "DELETE",
      }),
};
