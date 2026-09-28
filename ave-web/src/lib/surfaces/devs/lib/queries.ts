import { createMutation } from "@tanstack/svelte-query";
import {
  addOrganizationMember,
  createApp,
  createOrganization,
  deleteApp,
  removeOrganizationMember,
  rotateSecret,
  updateApp,
  updateOrganization,
  uploadWorkspaceLogo,
  type CreateAppPayload,
  type UpdateAppPayload,
} from "./api";
import { queryClient } from "./query-client";

export const queryKeys = {
  portal: (organizationId?: string) => ["portal", organizationId ?? "current"] as const,
  appIdentities: (appId: string) => ["appIdentities", appId] as const,
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
    onSuccess: async () => {
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

export function createAddMemberMutation() {
  return createMutation(() => ({
    mutationFn: async (payload: { organizationId: string; email: string }) =>
      addOrganizationMember(payload.organizationId, payload.email),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspace(variables.organizationId) });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    },
  }));
}

export function createRemoveMemberMutation() {
  return createMutation(() => ({
    mutationFn: async (payload: { organizationId: string; memberId: string }) =>
      removeOrganizationMember(payload.organizationId, payload.memberId),
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
      data: { name?: string; logoUrl?: string | null };
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
