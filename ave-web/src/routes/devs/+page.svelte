<script lang="ts">
  import { createPortalState, type WorkspaceSection, type AppSection } from "./portal-state.svelte";
  import { createAppActions } from "./app-actions";

  import { setQueryClientContext } from "@tanstack/svelte-query";
  import { onMount } from "svelte";
  import PortalView from "./sections/PortalView.svelte";
  import { fetchAppActivity, fetchAppIdentities, fetchAppOverview, fetchOrganization, fetchPortalBootstrap, ApiError, type AppOverviewBundle } from "$lib/surfaces/devs/lib/api";
  import { queryClient } from "$lib/surfaces/devs/lib/query-client";
  import { createCreateOrganizationMutation, createInviteMemberMutation, createUpdateMemberRoleMutation, createUpdateOrganizationMutation, createUploadWorkspaceLogoMutation, queryKeys } from "$lib/surfaces/devs/lib/queries";
  import type { WorkspaceRole } from "$lib/surfaces/devs/lib/portal";

  setQueryClientContext(queryClient);
  const state = createPortalState();
  const { handleCreate, handleRotateSecret, handleSaveApp, handleConfirmDelete, handleCopy, handleCreateResource, handleDeleteResource } = createAppActions(state, loadPortal, loadSelectedApp);

  const createOrganizationMutation = createCreateOrganizationMutation();
  const inviteMemberMutation = createInviteMemberMutation();
  const updateMemberRoleMutation = createUpdateMemberRoleMutation();
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
        state.selectedAppId = null;
        state.appInsights = null;
        state.appIdentities = [];
        state.appEvents = [];
        state.appIdentitiesTotal = 0;
        state.appEventsTotal = 0;
        state.appEventsCursor = null;
        state.appEventsHasMore = false;
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

  async function loadSelectedApp(appId: string) {
    const cachedBundle = queryClient.getQueryData<AppOverviewBundle>(queryKeys.appOverview(appId)) || state.appBundles[appId];

    if (cachedBundle) {
      applyAppBundle(cachedBundle);
      state.appLoading = false;
    } else {
      state.appInsights = null;
      state.appIdentities = [];
      state.appEvents = [];
      state.appIdentitiesTotal = 0;
      state.appEventsTotal = 0;
      state.appEventsCursor = null;
      state.appEventsHasMore = false;
      state.appLoading = true;
    }

    try {
      const bundle = await queryClient.fetchQuery({
        queryKey: queryKeys.appOverview(appId),
        queryFn: () => fetchAppOverview(appId),
      });
      state.appBundles = {
        ...state.appBundles,
        [appId]: bundle,
      };

      if (state.selectedAppId === appId) {
        applyAppBundle(bundle);
      }
    } catch (err) {
      if (state.selectedAppId === appId && !cachedBundle) {
        state.appInsights = null;
        state.appIdentities = [];
        state.appEvents = [];
        state.appIdentitiesTotal = 0;
        state.appEventsTotal = 0;
      }
      state.error = err instanceof Error ? err.message : "Failed to load app overview";
    } finally {
      if (state.selectedAppId === appId) {
        state.appLoading = false;
      }
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

  async function loadAppActivityPage(appId: string, reset = false) {
    if (state.appEventsLoadingMore) return;
    state.appEventsLoadingMore = true;

    try {
      const page = await queryClient.fetchQuery({
        queryKey: [...queryKeys.appActivity(appId), reset ? null : state.appEventsCursor, 25],
        queryFn: () => fetchAppActivity(appId, { limit: 25, cursor: reset ? undefined : state.appEventsCursor || undefined }),
      });
      state.appEvents = reset ? page.items : [...state.appEvents, ...page.items];
      state.appEventsCursor = page.nextCursor;
      state.appEventsHasMore = page.hasMore;
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to load app activity";
    } finally {
      state.appEventsLoadingMore = false;
    }
  }

  function applyAppBundle(bundle: AppOverviewBundle) {
    state.appInsights = bundle.insights;
    state.appIdentities = bundle.identities;
    state.appEvents = bundle.events;
    state.appIdentitiesTotal = bundle.insights.totalIdentities;
    state.appEventsTotal = bundle.insights.totalActivityEvents;
    state.appEventsCursor = null;
    state.appEventsHasMore = bundle.events.length < bundle.insights.totalActivityEvents;
  }

  function handleSignIn() {
    window.location.href = "https://aveid.net/login";
  }

  function openAveDashboard() {
    window.location.href = "https://aveid.net/dashboard";
  }

  function openWorkspace(section: WorkspaceSection) {
    state.selectedAppId = null;
    state.appInsights = null;
    state.appIdentities = [];
    state.appEvents = [];
    state.appIdentitiesTotal = 0;
    state.appEventsTotal = 0;
    state.appEventsCursor = null;
    state.appEventsHasMore = false;
    state.createModalOpen = false;
    state.createOrganizationModalOpen = false;
    state.workspaceSection = section;
  }

  async function switchOrganization(organizationId: string) {
    state.selectedAppId = null;
    state.appInsights = null;
    state.appIdentities = [];
    state.appEvents = [];
    state.appIdentitiesTotal = 0;
    state.appEventsTotal = 0;
    state.appEventsCursor = null;
    state.appEventsHasMore = false;
    state.appBundles = {};
    state.appLoading = false;
    state.createModalOpen = false;
    state.createOrganizationModalOpen = false;
    state.workspaceSection = "applications";
    await loadPortal(organizationId);
  }

  async function openApp(appId: string | null) {
    if (!appId) {
      state.selectedAppId = null;
      state.appInsights = null;
      state.appIdentities = [];
      state.appEvents = [];
      state.appIdentitiesTotal = 0;
      state.appEventsTotal = 0;
      state.appEventsCursor = null;
      state.appEventsHasMore = false;
      state.appLoading = false;
      state.createModalOpen = false;
      state.createOrganizationModalOpen = false;
      state.workspaceSection = "applications";
      return;
    }

    state.selectedAppId = appId;
    state.workspaceSection = "applications";
    state.appSection = "overview";
    void loadSelectedApp(appId);
  }

  function handleAppSectionSelect(id: string) {
    state.appSection = id as AppSection;

    if (!state.selectedAppId) return;

    if (state.appSection === "identities" && state.appIdentities.length < state.appIdentitiesTotal) {
      void loadAppIdentitiesPage(state.selectedAppId, true);
    }

    if (state.appSection === "activity" && (state.appEventsTotal === 0 || state.appEvents.length < state.appEventsTotal)) {
      void loadAppActivityPage(state.selectedAppId, true);
    }
  }

  async function handleInvite(email: string, role: WorkspaceRole) {
    if (!state.workspace) return;
    const organizationId = state.workspace.id;

    try {
      await inviteMemberMutation.mutateAsync({ organizationId, email, role });
      const refreshedWorkspace = await queryClient.fetchQuery({
        queryKey: queryKeys.workspace(organizationId),
        queryFn: () => fetchOrganization(organizationId),
      });
      state.workspace = refreshedWorkspace;
      state.organizations = state.organizations.map((organization) =>
        organization.id === refreshedWorkspace.id
          ? { ...organization, memberCount: refreshedWorkspace.members.filter((member) => member.status === "active").length }
          : organization,
      );
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to invite member";
    }
  }

  async function handleRoleChange(memberId: string, role: WorkspaceRole) {
    if (!state.workspace) return;
    const organizationId = state.workspace.id;

    try {
      await updateMemberRoleMutation.mutateAsync({ organizationId, memberId, role });
      state.workspace = await queryClient.fetchQuery({
        queryKey: queryKeys.workspace(organizationId),
        queryFn: () => fetchOrganization(organizationId),
      });
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to update role";
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
  appLoading={state.appLoading}
  appInsights={state.appInsights}
  appIdentities={state.appIdentities}
  appEvents={state.appEvents}
  appIdentitiesTotal={state.appIdentitiesTotal}
  appEventsTotal={state.appEventsTotal}
  appIdentitiesLoadingMore={state.appIdentitiesLoadingMore}
  appEventsLoadingMore={state.appEventsLoadingMore}
  appEventsHasMore={state.appEventsHasMore}
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
  {loadAppActivityPage}
  {handleSaveApp}
  {handleRotateSecret}
  {handleCreateResource}
  {handleDeleteResource}
  {handleCopy}
  {handleInvite}
  {handleRoleChange}
  {handleWorkspaceLogoUpload}
  {handleWorkspaceRename}
/>
