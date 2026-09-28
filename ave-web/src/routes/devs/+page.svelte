<script lang="ts">
  import { createPortalState, type WorkspaceSection, type AppSection } from "./portal-state.svelte";
  import { createAppActions } from "./app-actions";

  import { setQueryClientContext } from "@tanstack/svelte-query";
  import { onMount } from "svelte";
  import PortalView from "./sections/PortalView.svelte";
  import { fetchAppIdentities, fetchOrganization, fetchPortalBootstrap, ApiError } from "$lib/surfaces/devs/lib/api";
  import { queryClient } from "$lib/surfaces/devs/lib/query-client";
  import { createAddMemberMutation, createCreateOrganizationMutation, createRemoveMemberMutation, createUpdateOrganizationMutation, createUploadWorkspaceLogoMutation, queryKeys } from "$lib/surfaces/devs/lib/queries";

  setQueryClientContext(queryClient);
  const state = createPortalState();
  const { handleCreate, handleRotateSecret, handleSaveApp, handleConfirmDelete, handleCopy } = createAppActions(state, loadPortal, openApp);

  const createOrganizationMutation = createCreateOrganizationMutation();
  const addMemberMutation = createAddMemberMutation();
  const removeMemberMutation = createRemoveMemberMutation();
  const updateOrganizationMutation = createUpdateOrganizationMutation();
  const uploadWorkspaceLogoMutation = createUploadWorkspaceLogoMutation();

  onMount(() => {
    init();

    return () => {
      if (state.saveStateTimer) clearTimeout(state.saveStateTimer);
      if (state.rotateStateTimer) clearTimeout(state.rotateStateTimer);
    };
  });

  async function init() {
    state.loading = true;
    state.authenticated = true;
    await loadPortal(new URL(window.location.href).searchParams.get("organizationId") || undefined);

    state.loading = false;
  }

  async function loadPortal(targetOrganizationId?: string) {
    state.loading = true;

    try {
      const bootstrap = await queryClient.fetchQuery({
        queryKey: queryKeys.portal(targetOrganizationId),
        queryFn: () => fetchPortalBootstrap(targetOrganizationId),
      });
      state.organizations = bootstrap.organizations;
      state.currentOrganizationId = bootstrap.currentOrganizationId;
      state.workspace = bootstrap.organization;
      state.apps = bootstrap.apps;

      if (state.selectedAppId && !bootstrap.apps.some((app) => app.id === state.selectedAppId)) {
        clearSelectedApp();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        state.authenticated = false;
        state.apps = [];
        state.workspace = null;
        state.organizations = [];
        state.currentOrganizationId = null;
      } else {
        state.authenticated = true;
      }
      state.error = err instanceof Error ? err.message : "Failed to load portal";
    } finally {
      state.loading = false;
    }
  }

  async function loadAppIdentitiesPage(appId: string, reset = false) {
    const nextOffset = reset ? 0 : state.appIdentities.length;
    if (!reset) {
      state.appIdentitiesLoadingMore = true;
    }

    try {
      const page = await queryClient.fetchQuery({
        queryKey: [...queryKeys.appIdentities(appId), nextOffset, 25],
        queryFn: () => fetchAppIdentities(appId, { limit: 25, offset: nextOffset }),
      });
      state.appIdentities = reset
        ? page.items
        : [...new Map([...state.appIdentities, ...page.items].map((identity) => [identity.id, identity])).values()];
      state.appIdentitiesTotal = page.total;
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to load app identities";
    } finally {
      state.appIdentitiesLoadingMore = false;
    }
  }

  function clearSelectedApp() {
    state.selectedAppId = null;
    state.appIdentities = [];
    state.appIdentitiesTotal = 0;
  }

  function handleSignIn() {
    window.location.href = "https://aveid.net/login";
  }

  function openAveDashboard() {
    window.location.href = "https://aveid.net/dashboard";
  }

  function openWorkspace(section: WorkspaceSection) {
    clearSelectedApp();
    state.createModalOpen = false;
    state.createOrganizationModalOpen = false;
    state.workspaceSection = section;
  }

  async function switchOrganization(organizationId: string) {
    clearSelectedApp();
    state.createModalOpen = false;
    state.createOrganizationModalOpen = false;
    state.workspaceSection = "applications";
    await loadPortal(organizationId);
  }

  function openApp(appId: string | null) {
    clearSelectedApp();
    state.createModalOpen = false;
    state.createOrganizationModalOpen = false;
    state.workspaceSection = "applications";
    if (!appId) return;

    state.selectedAppId = appId;
    state.appSection = "configure";
    void loadAppIdentitiesPage(appId, true);
  }

  function handleAppSectionSelect(id: string) {
    state.appSection = id as AppSection;
  }

  async function refreshWorkspace(organizationId: string) {
    const refreshedWorkspace = await queryClient.fetchQuery({
      queryKey: queryKeys.workspace(organizationId),
      queryFn: () => fetchOrganization(organizationId),
    });
    state.workspace = refreshedWorkspace;
    state.organizations = state.organizations.map((organization) =>
      organization.id === refreshedWorkspace.id
        ? { ...organization, memberCount: refreshedWorkspace.members.length }
        : organization,
    );
  }

  async function handleAddMember(email: string) {
    if (!state.workspace) return;
    const organizationId = state.workspace.id;

    try {
      await addMemberMutation.mutateAsync({ organizationId, email });
      await refreshWorkspace(organizationId);
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to add member";
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!state.workspace) return;
    const organizationId = state.workspace.id;

    try {
      await removeMemberMutation.mutateAsync({ organizationId, memberId });
      await refreshWorkspace(organizationId);
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to remove member";
    }
  }

  async function handleWorkspaceRename(name: string) {
    if (!state.workspace) return;

    try {
      const updated = await updateOrganizationMutation.mutateAsync({
        organizationId: state.workspace.id,
        data: { name },
      });
      state.workspace = {
        ...state.workspace,
        name: updated.name,
        logoUrl: updated.logoUrl,
      };
      state.organizations = state.organizations.map((organization) =>
        organization.id === state.workspace?.id
          ? { ...organization, name: updated.name, logoUrl: updated.logoUrl }
          : organization,
      );
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to update workspace";
    }
  }

  async function handleWorkspaceLogoUpload(file: File) {
    if (!state.workspace) return;

    try {
      const result = await uploadWorkspaceLogoMutation.mutateAsync({ organizationId: state.workspace.id, file });
      state.workspace = {
        ...state.workspace,
        logoUrl: result.logoUrl,
      };
      state.organizations = state.organizations.map((organization) =>
        organization.id === state.workspace?.id
          ? { ...organization, logoUrl: result.logoUrl }
          : organization,
      );
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to upload workspace logo";
    }
  }

  async function handleCreateOrganization() {
    const name = state.newOrganizationName.trim();
    if (!name) return;

    state.creatingOrganization = true;

    try {
      const result = await createOrganizationMutation.mutateAsync(name);
      state.newOrganizationName = "";
      state.createOrganizationModalOpen = false;
      await loadPortal(result.organization.id);
      state.workspaceSection = "organization";
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to create organization";
    } finally {
      state.creatingOrganization = false;
    }
  }
</script>

<PortalView
  authenticated={state.authenticated}
  loading={state.loading}
  workspace={state.workspace}
  currentOrganizationId={state.currentOrganizationId}
  organizations={state.organizations}
  apps={state.apps}
  selectedAppId={state.selectedAppId}
  selectedApp={state.selectedApp}
  appNav={state.appNav}
  workspaceNav={state.workspaceNav}
  appSection={state.appSection}
  bind:workspaceSection={state.workspaceSection}
  bind:deleteTarget={state.deleteTarget}
  deleting={state.deleting}
  bind:error={state.error}
  bind:newSecret={state.newSecret}
  bind:createModalOpen={state.createModalOpen}
  bind:createOrganizationModalOpen={state.createOrganizationModalOpen}
  bind:newOrganizationName={state.newOrganizationName}
  creating={state.creating}
  creatingOrganization={state.creatingOrganization}
  appIdentities={state.appIdentities}
  appIdentitiesTotal={state.appIdentitiesTotal}
  appIdentitiesLoadingMore={state.appIdentitiesLoadingMore}
  saveState={state.saveState}
  rotatingAppId={state.rotatingAppId}
  rotatedAppId={state.rotatedAppId}
  {handleSignIn}
  {openAveDashboard}
  {openWorkspace}
  {switchOrganization}
  {openApp}
  {handleAppSectionSelect}
  {handleConfirmDelete}
  {handleCreate}
  {handleCreateOrganization}
  {loadAppIdentitiesPage}
  {handleSaveApp}
  {handleRotateSecret}
  {handleCopy}
  {handleAddMember}
  {handleRemoveMember}
  {handleWorkspaceLogoUpload}
  {handleWorkspaceRename}
/>
