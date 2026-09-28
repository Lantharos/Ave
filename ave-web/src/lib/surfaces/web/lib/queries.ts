import { createInfiniteQuery, createMutation, createQuery } from "@tanstack/svelte-query";
import { api, type ActivityLogEntry, type Device, type LoginRequest, type Passkey } from "./api";
import { queryClient } from "./query-client";

const QUERY_KEYS = {
  devices: ["devices"] as const,
  pendingRequests: ["pendingRequests"] as const,
  security: ["security"] as const,
  activity: (severity: "all" | "info" | "warning" | "danger") => ["activity", severity] as const,
};

export interface SecuritySnapshot {
  passkeys: Passkey[];
  trustCodesRemaining: number;
  recoveryCodesRemaining: number;
  hasRecoveryCodes: boolean;
}

export function createDevicesQuery() {
  return createQuery(() => ({
    queryKey: QUERY_KEYS.devices,
    queryFn: async (): Promise<Device[]> => {
      const data = await api.devices.list();
      return data.devices.filter((device) => device.isActive);
    },
  }));
}

export function createPendingRequestsQuery() {
  return createQuery(() => ({
    queryKey: QUERY_KEYS.pendingRequests,
    queryFn: async (): Promise<LoginRequest[]> => {
      const { requests } = await api.devices.getPendingRequests();
      return requests;
    },
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  }));
}

export function createSecurityQuery() {
  return createQuery(() => ({
    queryKey: QUERY_KEYS.security,
    queryFn: async (): Promise<SecuritySnapshot> => api.security.get(),
  }));
}

type ActivityFilter = "all" | "info" | "warning" | "danger";

export function createActivityInfiniteQuery(getSeverity: () => ActivityFilter, pageSize = 20) {
  return createInfiniteQuery(() => ({
    queryKey: QUERY_KEYS.activity(getSeverity()),
    queryFn: async ({ pageParam = 0 }): Promise<ActivityLogEntry[]> => {
      const severity = getSeverity();
      const result = await api.activity.list({
        limit: pageSize,
        offset: pageParam,
        severity: severity === "all" ? undefined : severity,
      });

      return result.logs;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < pageSize) return undefined;
      const loaded = allPages.reduce((sum, page) => sum + page.length, 0);
      return loaded;
    },
  }));
}

export function createRevokeDeviceMutation() {
  return createMutation(() => ({
    mutationFn: async (deviceId: string) => {
      await api.devices.revoke(deviceId);
      return deviceId;
    },
    onSuccess: (_, deviceId) => {
      queryClient.setQueryData<Device[]>(QUERY_KEYS.devices, (previous = []) =>
        previous.filter((device) => device.id !== deviceId)
      );
    },
  }));
}

export function createDeletePasskeyMutation() {
  return createMutation(() => ({
    mutationFn: async (passkeyId: string) => {
      await api.security.deletePasskey(passkeyId);
      return passkeyId;
    },
    onSuccess: (_, passkeyId) => {
      queryClient.setQueryData<SecuritySnapshot>(QUERY_KEYS.security, (previous) => {
        if (!previous) return previous;
        return {
          ...previous,
          passkeys: previous.passkeys.filter((passkey) => passkey.id !== passkeyId),
        };
      });
    },
  }));
}

export const queryKeys = QUERY_KEYS;
