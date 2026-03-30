import { createInfiniteQuery, createMutation, createQuery } from "@tanstack/svelte-query";
import { api, type Device, type ActivityLogEntry, type LoginRequest, type Passkey, type RecipientSharedSecretEnvelope } from "./api";
import { queryClient } from "./query-client";

const QUERY_KEYS = {
  devices: ["devices"] as const,
  pendingRequests: ["pendingRequests"] as const,
  security: ["security"] as const,
  delegations: ["delegations"] as const,
  sharedSecrets: ["sharedSecrets"] as const,
  sharedSecretAccess: ["sharedSecretAccess"] as const,
  activity: (severity: "all" | "info" | "warning" | "danger") => ["activity", severity] as const,
};

export interface SecuritySnapshot {
  passkeys: Passkey[];
  trustCodesRemaining: number;
  recoveryCodesRemaining: number;
  hasRecoveryCodes: boolean;
  securityQuestionIds: number[];
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

export function createDelegationsQuery() {
  return createQuery(() => ({
    queryKey: QUERY_KEYS.delegations,
    queryFn: async () => {
      const result = await api.oauth.getDelegations();
      return result.delegations;
    },
  }));
}

export function createSharedSecretsQuery() {
  return createQuery(() => ({
    queryKey: QUERY_KEYS.sharedSecrets,
    queryFn: async () => api.sharedSecrets.list(),
  }));
}

export function createSharedSecretAccessQuery() {
  return createQuery(() => ({
    queryKey: QUERY_KEYS.sharedSecretAccess,
    queryFn: async (): Promise<RecipientSharedSecretEnvelope[]> => {
      const result = await api.sharedSecrets.getAccess();
      return result.access;
    },
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

export function createConnectAuthorizeBootstrapQuery(getClientId: () => string, getResourceKey: () => string) {
  return createQuery(() => ({
    queryKey: ["connectAuthorizeBootstrap", getClientId(), getResourceKey()],
    enabled: Boolean(getClientId() && getResourceKey()),
    staleTime: 60_000,
    queryFn: async () => {
      const [appData, resourceData] = await Promise.all([
        api.oauth.getApp(getClientId()),
        api.oauth.getResource(getResourceKey()),
      ]);

      return {
        app: appData.app,
        resource: resourceData.resource,
      };
    },
  }));
}

export function createAuthorizeConnectorMutation() {
  return createMutation(() => ({
    mutationFn: api.oauth.authorize,
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

export function createRevokeDelegationMutation() {
  return createMutation(() => ({
    mutationFn: async (delegationId: string) => {
      await api.oauth.revokeDelegation(delegationId);
      return delegationId;
    },
    onSuccess: (_, delegationId) => {
      queryClient.setQueryData<any[]>(QUERY_KEYS.delegations, (previous = []) =>
        previous.filter((delegation) => delegation.id !== delegationId)
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
