import { createInfiniteQuery, createMutation, createQuery } from "@tanstack/svelte-query";
import {
  createApp,
  createOrganization,
  createResource,
  deleteApp,
  deleteResource,
  fetchAppActivity,
  fetchAppIdentities,
  fetchAppOverview,
  fetchOrganization,
  fetchPortalBootstrap,
  inviteOrganizationMember,
  rotateSecret,
  updateApp,
  updateOrganization,
  updateOrganizationMemberRole,
  uploadWorkspaceLogo,
  type AppOverviewBundle,
  type CreateAppPayload,
  type PortalBootstrap,
  type UpdateAppPayload,
} from "./api";
import type { WorkspaceRole } from "./portal";
import { queryClient } from "./query-client";

export const queryKeys = {
  portal: (organizationId?: string) => ["portal", organizationId ?? "current"] as const,
  appOverview: (appId: string) => ["appOverview", appId] as const,
  appIdentities: (appId: string) => ["appIdentities", appId] as const,
  appActivity: (appId: string) => ["appActivity", appId] as const,
  workspace: (organizationId: string) => ["workspace", organizationId] as const,
};

export function createPortalBootstrapQuery(getOrganizationId: () => string | null) {
  return createQuery(() => {
    const organizationId = getOrganizationId();

    return {
      queryKey: queryKeys.portal(organizationId ?? undefined),
      queryFn: async (): Promise<PortalBootstrap> => fetchPortalBootstrap(organizationId ?? undefined),
    };
  });
}

export function createAppOverviewQuery(getAppId: () => string | null) {
  return createQuery(() => {
    const appId = getAppId();

    return {
      queryKey: queryKeys.appOverview(appId ?? ""),
      queryFn: async (): Promise<AppOverviewBundle> => fetchAppOverview(appId as string),
      enabled: Boolean(appId),
    };
  });
}

export function createAppIdentitiesInfiniteQuery(getAppId: () => string | null, pageSize = 25) {
  return createInfiniteQuery(() => {
    const appId = getAppId();

    return {
      queryKey: queryKeys.appIdentities(appId ?? ""),
      enabled: Boolean(appId),
      initialPageParam: 0,
      queryFn: async ({ pageParam = 0 }) =>
        fetchAppIdentities(appId as string, { limit: pageSize, offset: pageParam }),
      getNextPageParam: (lastPage) => {
        if (!lastPage.hasMore) return undefined;
        return lastPage.offset + lastPage.items.length;
      },
    };
  });
}

export function createAppActivityInfiniteQuery(getAppId: () => string | null, pageSize = 25) {
  return createInfiniteQuery(() => {
    const appId = getAppId();

    return {
      queryKey: queryKeys.appActivity(appId ?? ""),
      enabled: Boolean(appId),
      initialPageParam: 0,
      queryFn: async ({ pageParam = 0 }) =>
        fetchAppActivity(appId as string, { limit: pageSize, offset: pageParam }),
      getNextPageParam: (lastPage) => {
        if (!lastPage.hasMore) return undefined;
        return lastPage.offset + lastPage.items.length;
      },
    };
  });
}

export function createCreateAppMutation(getOrganizationId: () => string | null) {
  return createMutation(() => ({
    mutationFn: async (payload: Omit<CreateAppPayload, "organizationId">) =>
      createApp({ ...payload, organizationId: getOrganizationId() ?? undefined }),
    onSuccess: async (_, _variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.portal(getOrganizationId() ?? undefined) });
    },
  }));
}

export function createUpdateAppMutation() {
  return createMutation(() => ({
    mutationFn: async (payload: { appId: string; data: UpdateAppPayload }) =>
      updateApp(payload.appId, payload.data),
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.appOverview(variables.appId) });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      queryClient.setQueryData(queryKeys.appOverview(variables.appId), (previous: AppOverviewBundle | undefined) => {
        if (!previous) return previous;
        return previous;
      });
      return result;
    },
  }));
}

export function createDeleteAppMutation() {
  return createMutation(() => ({
    mutationFn: async (appId: string) => deleteApp(appId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  }));
}

export function createRotateSecretMutation() {
  return createMutation(() => ({
    mutationFn: async (appId: string) => rotateSecret(appId),
  }));
}

export function createCreateOrganizationMutation() {
  return createMutation(() => ({
    mutationFn: async (name: string) => createOrganization(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  }));
}

export function createInviteMemberMutation() {
  return createMutation(() => ({
    mutationFn: async (payload: { organizationId: string; email: string; role: WorkspaceRole }) =>
      inviteOrganizationMember(payload.organizationId, { email: payload.email, role: payload.role }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(variables.organizationId) });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  }));
}

export function createUpdateMemberRoleMutation() {
  return createMutation(() => ({
    mutationFn: async (payload: { organizationId: string; memberId: string; role: WorkspaceRole }) =>
      updateOrganizationMemberRole(payload.organizationId, payload.memberId, payload.role),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(variables.organizationId) });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  }));
}

export function createUpdateOrganizationMutation() {
  return createMutation(() => ({
    mutationFn: async (payload: {
      organizationId: string;
      data: { name?: string; logoUrl?: string | null; verifiedDomains?: string[] };
    }) => updateOrganization(payload.organizationId, payload.data),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(variables.organizationId) });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  }));
}

export function createUploadWorkspaceLogoMutation() {
  return createMutation(() => ({
    mutationFn: async (payload: { organizationId: string; file: File }) =>
      uploadWorkspaceLogo(payload.organizationId, payload.file),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(variables.organizationId) });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  }));
}

export function createCreateResourceMutation() {
  return createMutation(() => ({
    mutationFn: async (payload: {
      appId: string;
      resource: {
        resourceKey: string;
        displayName: string;
        description?: string;
        scopes: string[];
        audience: string;
        status: "active" | "disabled";
      };
    }) => createResource(payload.appId, payload.resource),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.appOverview(variables.appId) });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  }));
}

export function createDeleteResourceMutation() {
  return createMutation(() => ({
    mutationFn: async (payload: { appId: string; resourceId: string }) =>
      deleteResource(payload.appId, payload.resourceId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.appOverview(variables.appId) });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  }));
}

export function createWorkspaceQuery(getOrganizationId: () => string | null) {
  return createQuery(() => {
    const organizationId = getOrganizationId();

    return {
      queryKey: queryKeys.workspace(organizationId ?? ""),
      enabled: Boolean(organizationId),
      queryFn: () => fetchOrganization(organizationId as string),
    };
  });
}
