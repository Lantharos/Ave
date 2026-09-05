import { createMutation } from "@tanstack/svelte-query";
import {
  createApp,
  createOrganization,
  createResource,
  deleteApp,
  deleteResource,
  inviteOrganizationMember,
  rotateSecret,
  updateApp,
  updateOrganization,
  updateOrganizationMemberRole,
  uploadWorkspaceLogo,
  type CreateAppPayload,
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
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.appOverview(variables.appId) });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
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
    mutationFn: async (payload: { organizationId: string; actingIdentityId: string; email: string; role: WorkspaceRole }) =>
      inviteOrganizationMember(payload.organizationId, payload.actingIdentityId, { email: payload.email, role: payload.role }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(variables.organizationId) });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  }));
}

export function createUpdateMemberRoleMutation() {
  return createMutation(() => ({
    mutationFn: async (payload: { organizationId: string; actingIdentityId: string; memberId: string; role: WorkspaceRole }) =>
      updateOrganizationMemberRole(payload.organizationId, payload.actingIdentityId, payload.memberId, payload.role),
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
      actingIdentityId: string;
      data: { name?: string; logoUrl?: string | null };
    }) => updateOrganization(payload.organizationId, payload.actingIdentityId, payload.data),
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
