<script lang="ts">
  import { setQueryClientContext } from "@tanstack/svelte-query";
  import { onMount } from "svelte";
  import PortalView from "./sections/PortalView.svelte";
  import {
    fetchAppActivity,
    fetchAppIdentities,
    fetchAppOverview,
    fetchOrganization,
    fetchPortalBootstrap,
    ApiError,
    type AppEvent,
    type AppIdentityRecord,
    type AppInsightSnapshot,
    type AppOverviewBundle,
    type DevApp,
    type UpdateAppPayload,
  } from "$lib/surfaces/devs/lib/api";
  import { queryClient } from "$lib/surfaces/devs/lib/query-client";
  import {
    createCreateAppMutation,
    createCreateOrganizationMutation,
    createCreateResourceMutation,
    createDeleteAppMutation,
    createDeleteResourceMutation,
    createInviteMemberMutation,
    createRotateSecretMutation,
    createUpdateAppMutation,
    createUpdateMemberRoleMutation,
    createUpdateOrganizationMutation,
    createUploadWorkspaceLogoMutation,
    queryKeys,
  } from "$lib/surfaces/devs/lib/queries";
  import type { WorkspaceRole, WorkspaceState, WorkspaceSummary } from "$lib/surfaces/devs/lib/portal";

  type WorkspaceSection = "applications" | "organization";
  type AppSection = "overview" | "identities" | "activity" | "configure";

  setQueryClientContext(queryClient);

  const createAppMutation = createCreateAppMutation(() => currentOrganizationId);
  const updateAppMutation = createUpdateAppMutation();
  const deleteAppMutation = createDeleteAppMutation();
  const rotateSecretMutation = createRotateSecretMutation();
  const createOrganizationMutation = createCreateOrganizationMutation();
  const inviteMemberMutation = createInviteMemberMutation();
  const updateMemberRoleMutation = createUpdateMemberRoleMutation();
  const updateOrganizationMutation = createUpdateOrganizationMutation();
  const uploadWorkspaceLogoMutation = createUploadWorkspaceLogoMutation();
  const createResourceMutation = createCreateResourceMutation();
  const deleteResourceMutation = createDeleteResourceMutation();

  let workspaceSection: WorkspaceSection = $state("applications");
  let appSection: AppSection = $state("overview");
  let organizations: WorkspaceSummary[] = $state([]);
  let currentOrganizationId: string | null = $state(null);
  let workspace: WorkspaceState | null = $state(null);
  let apps: DevApp[] = $state([]);
  let selectedAppId: string | null = $state(null);
  let appInsights: AppInsightSnapshot | null = $state(null);
  let appIdentities: AppIdentityRecord[] = $state([]);
  let appEvents: AppEvent[] = $state([]);
  let appIdentitiesTotal = $state(0);
  let appEventsTotal = $state(0);
  let appEventsCursor: string | null = $state(null);
  let appEventsHasMore = $state(false);
  let appIdentitiesLoadingMore = $state(false);
  let appEventsLoadingMore = $state(false);
  let appBundles: Record<string, AppOverviewBundle> = $state({});
  let deleteTarget: DevApp | null = $state(null);
  let createModalOpen = $state(false);
  let createOrganizationModalOpen = $state(false);
  let newOrganizationName = $state("");
  let creatingOrganization = $state(false);
  let loading = $state(true);
  let appLoading = $state(false);
  let error = $state("");
  let authenticated = $state(false);
  let newSecret: string | null = $state(null);
  let creating = $state(false);
  let deleting = $state(false);
  let saveState: "idle" | "saving" | "saved" = $state("idle");
  let rotatingAppId: string | null = $state(null);
  let rotatedAppId: string | null = $state(null);
  let saveStateTimer: ReturnType<typeof setTimeout> | null = null;
  let rotateStateTimer: ReturnType<typeof setTimeout> | null = null;

  const selectedApp = $derived.by(() => {
    const app = apps.find((entry) => entry.id === selectedAppId);
    if (!app) return null;

    return {
      ...app,
      redirectUrisText: app.redirectUris.join("\n"),
    };
  });

  const activeWorkspaceMembers = $derived.by(() =>
    workspace ? workspace.members.filter((member) => member.status === "active").length : 0,
  );

  const workspaceNav = $derived([
    { id: "applications", label: "Applications", badge: apps.length },
    { id: "organization", label: "Organization", badge: activeWorkspaceMembers },
  ]);

  const appNav = $derived([
    { id: "overview", label: "Overview" },
    { id: "identities", label: "Identities", badge: appIdentitiesTotal || appIdentities.length },
    { id: "activity", label: "Activity", badge: appEventsTotal || appEvents.length },
    { id: "configure", label: "Configure" },
  ]);

  onMount(() => {
    init();

    return () => {
      if (saveStateTimer) clearTimeout(saveStateTimer);
      if (rotateStateTimer) clearTimeout(rotateStateTimer);
    };
  });

  async function init() {
    loading = true;
    authenticated = true;
    await loadPortal();

    loading = false;
  }

  async function loadPortal(targetOrganizationId?: string) {
    loading = true;

    try {
      const bootstrap = await queryClient.fetchQuery({
        queryKey: queryKeys.portal(targetOrganizationId),
        queryFn: () => fetchPortalBootstrap(targetOrganizationId),
      });
      organizations = bootstrap.organizations;
      currentOrganizationId = bootstrap.currentOrganizationId;
      workspace = bootstrap.organization;
      apps = bootstrap.apps;

      if (selectedAppId && !bootstrap.apps.some((app) => app.id === selectedAppId)) {
        selectedAppId = null;
        appInsights = null;
        appIdentities = [];
        appEvents = [];
        appIdentitiesTotal = 0;
        appEventsTotal = 0;
        appEventsCursor = null;
        appEventsHasMore = false;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        authenticated = false;
        apps = [];
        workspace = null;
        organizations = [];
        currentOrganizationId = null;
      } else {
        authenticated = true;
      }
      error = err instanceof Error ? err.message : "Failed to load portal";
    } finally {
      loading = false;
    }
  }

  async function loadSelectedApp(appId: string) {
    const cachedBundle = queryClient.getQueryData<AppOverviewBundle>(queryKeys.appOverview(appId)) || appBundles[appId];

    if (cachedBundle) {
      applyAppBundle(cachedBundle);
      appLoading = false;
    } else {
      appInsights = null;
      appIdentities = [];
      appEvents = [];
      appIdentitiesTotal = 0;
      appEventsTotal = 0;
      appEventsCursor = null;
      appEventsHasMore = false;
      appLoading = true;
    }

    try {
      const bundle = await queryClient.fetchQuery({
        queryKey: queryKeys.appOverview(appId),
        queryFn: () => fetchAppOverview(appId),
      });
      appBundles = {
        ...appBundles,
        [appId]: bundle,
      };

      if (selectedAppId === appId) {
        applyAppBundle(bundle);
      }
    } catch (err) {
      if (selectedAppId === appId && !cachedBundle) {
        appInsights = null;
        appIdentities = [];
        appEvents = [];
        appIdentitiesTotal = 0;
        appEventsTotal = 0;
      }
      error = err instanceof Error ? err.message : "Failed to load app overview";
    } finally {
      if (selectedAppId === appId) {
        appLoading = false;
      }
    }
  }

  async function loadAppIdentitiesPage(appId: string, reset = false) {
    const nextOffset = reset ? 0 : appIdentities.length;
    if (!reset) {
      appIdentitiesLoadingMore = true;
    }

    try {
      const page = await queryClient.fetchQuery({
        queryKey: [...queryKeys.appIdentities(appId), nextOffset, 25],
        queryFn: () => fetchAppIdentities(appId, { limit: 25, offset: nextOffset }),
      });
      appIdentities = reset
        ? page.items
        : [...new Map([...appIdentities, ...page.items].map((identity) => [identity.id, identity])).values()];
      appIdentitiesTotal = page.total;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load app identities";
    } finally {
      appIdentitiesLoadingMore = false;
    }
  }

  async function loadAppActivityPage(appId: string, reset = false) {
    if (appEventsLoadingMore) return;
    appEventsLoadingMore = true;

    try {
      const page = await queryClient.fetchQuery({
        queryKey: [...queryKeys.appActivity(appId), reset ? null : appEventsCursor, 25],
        queryFn: () => fetchAppActivity(appId, { limit: 25, cursor: reset ? undefined : appEventsCursor || undefined }),
      });
      appEvents = reset ? page.items : [...appEvents, ...page.items];
      appEventsCursor = page.nextCursor;
      appEventsHasMore = page.hasMore;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load app activity";
    } finally {
      appEventsLoadingMore = false;
    }
  }

  function applyAppBundle(bundle: AppOverviewBundle) {
    appInsights = bundle.insights;
    appIdentities = bundle.identities;
    appEvents = bundle.events;
    appIdentitiesTotal = bundle.insights.totalIdentities;
    appEventsTotal = bundle.insights.totalActivityEvents;
    appEventsCursor = null;
    appEventsHasMore = bundle.events.length < bundle.insights.totalActivityEvents;
  }

  function handleSignIn() {
    window.location.href = "https://aveid.net/login";
  }

  function openAveDashboard() {
    window.location.href = "https://aveid.net/dashboard";
  }

  function openWorkspace(section: WorkspaceSection) {
    selectedAppId = null;
    appInsights = null;
    appIdentities = [];
    appEvents = [];
    appIdentitiesTotal = 0;
    appEventsTotal = 0;
    appEventsCursor = null;
    appEventsHasMore = false;
    createModalOpen = false;
    createOrganizationModalOpen = false;
    workspaceSection = section;
  }

  async function switchOrganization(organizationId: string) {
    selectedAppId = null;
    appInsights = null;
    appIdentities = [];
    appEvents = [];
    appIdentitiesTotal = 0;
    appEventsTotal = 0;
    appEventsCursor = null;
    appEventsHasMore = false;
    appBundles = {};
    appLoading = false;
    createModalOpen = false;
    createOrganizationModalOpen = false;
    workspaceSection = "applications";
    await loadPortal(organizationId);
  }

  async function openApp(appId: string | null) {
    if (!appId) {
      selectedAppId = null;
      appInsights = null;
      appIdentities = [];
      appEvents = [];
      appIdentitiesTotal = 0;
      appEventsTotal = 0;
      appEventsCursor = null;
      appEventsHasMore = false;
      appLoading = false;
      createModalOpen = false;
      createOrganizationModalOpen = false;
      workspaceSection = "applications";
      return;
    }

    selectedAppId = appId;
    workspaceSection = "applications";
    appSection = "overview";
    void loadSelectedApp(appId);
  }

  function handleAppSectionSelect(id: string) {
    appSection = id as AppSection;

    if (!selectedAppId) return;

    if (appSection === "identities" && appIdentities.length < appIdentitiesTotal) {
      void loadAppIdentitiesPage(selectedAppId, true);
    }

    if (appSection === "activity" && (appEventsTotal === 0 || appEvents.length < appEventsTotal)) {
      void loadAppActivityPage(selectedAppId, true);
    }
  }

  async function handleCreate(form: {
    name: string;
    description: string;
    websiteUrl: string;
    iconUrl: string;
    redirectUris: string;
    developmentMode: boolean;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    allowedScopes: string[];
  }) {
    if (!currentOrganizationId) return;

    creating = true;
    error = "";
    newSecret = null;

    try {
      const redirectUris = form.redirectUris
        .split("\n")
        .map((uri) => uri.trim())
        .filter(Boolean);

      const result = await createAppMutation.mutateAsync({
        name: form.name,
        description: form.description || undefined,
        websiteUrl: form.websiteUrl || undefined,
        iconUrl: form.iconUrl || undefined,
        redirectUris,
        developmentMode: form.developmentMode,
        accessTokenTtlSeconds: form.accessTokenTtlSeconds,
        refreshTokenTtlSeconds: form.refreshTokenTtlSeconds,
        allowedScopes: form.allowedScopes,
      });

      apps = [result.app, ...apps];
      newSecret = result.clientSecret;
      appBundles = {};
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      createModalOpen = false;
      if (workspace) {
        workspace = {
          ...workspace,
          appCount: workspace.appCount + 1,
        };
      }
      await loadSelectedApp(result.app.id);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create app";
    } finally {
      creating = false;
    }
  }

  async function handleRotateSecret(appId: string) {
    error = "";
    rotatingAppId = appId;
    rotatedAppId = null;

    try {
      const result = await rotateSecretMutation.mutateAsync(appId);
      newSecret = result.clientSecret;
      rotatedAppId = appId;
      if (rotateStateTimer) clearTimeout(rotateStateTimer);
      rotateStateTimer = setTimeout(() => {
        rotatedAppId = null;
      }, 1800);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to rotate secret";
    } finally {
      rotatingAppId = null;
    }
  }

  async function handleSaveApp(app: DevApp & { redirectUrisText?: string }) {
    error = "";
    saveState = "saving";
    const previousOrganizationId = apps.find((entry) => entry.id === app.id)?.organizationId ?? null;
    const normalizeOptionalText = (value?: string) => {
      const nextValue = value?.trim();
      return nextValue ? nextValue : null;
    };

    try {
      const payload: UpdateAppPayload = {
        name: app.name,
        description: normalizeOptionalText(app.description),
        websiteUrl: normalizeOptionalText(app.websiteUrl),
        iconUrl: normalizeOptionalText(app.iconUrl),
        redirectUris: (app.redirectUrisText || "")
          .split("\n")
          .map((uri) => uri.trim())
          .filter(Boolean),
        developmentMode: app.developmentMode,
        allowedScopes: app.allowedScopes,
        accessTokenTtlSeconds: app.accessTokenTtlSeconds,
        refreshTokenTtlSeconds: app.refreshTokenTtlSeconds,
        organizationId: app.organizationId || undefined,
      };

      const result = await updateAppMutation.mutateAsync({
        appId: app.id,
        data: payload,
      });
      const organizationChanged = result.app.organizationId !== previousOrganizationId;
      await queryClient.invalidateQueries({ queryKey: queryKeys.appOverview(app.id) });
      await queryClient.invalidateQueries({ queryKey: ["portal"] });

      if (organizationChanged) {
        appBundles = {};
        selectedAppId = result.app.id;
        appSection = "configure";
        await loadPortal(result.app.organizationId || undefined);
        await loadSelectedApp(result.app.id);
      } else {
        apps = apps.map((entry) => (entry.id === result.app.id ? result.app : entry));
        appBundles = Object.fromEntries(
          Object.entries(appBundles).filter(([key]) => key !== app.id),
        );
        await loadSelectedApp(app.id);
      }
      saveState = "saved";

      if (saveStateTimer) clearTimeout(saveStateTimer);
      saveStateTimer = setTimeout(() => {
        saveState = "idle";
      }, 1800);
    } catch (err) {
      saveState = "idle";
      error = err instanceof Error ? err.message : "Failed to update app";
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    error = "";
    deleting = true;
    const target = deleteTarget;

    try {
      await deleteAppMutation.mutateAsync(target.id);
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      queryClient.removeQueries({ queryKey: queryKeys.appOverview(target.id) });
      queryClient.removeQueries({ queryKey: queryKeys.appIdentities(target.id) });
      queryClient.removeQueries({ queryKey: queryKeys.appActivity(target.id) });
      apps = apps.filter((app) => app.id !== target.id);
      appBundles = Object.fromEntries(
        Object.entries(appBundles).filter(([key]) => key !== target.id),
      );
      if (workspace) {
        workspace = {
          ...workspace,
          appCount: Math.max(0, workspace.appCount - 1),
        };
      }
      if (selectedAppId === target.id) {
        selectedAppId = null;
        appInsights = null;
        appIdentities = [];
        appEvents = [];
        workspaceSection = "applications";
      }
      deleteTarget = null;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to delete app";
    } finally {
      deleting = false;
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      error = "Failed to copy to clipboard";
    }
  }

  async function handleCreateResource(appId: string, resource: {
    resourceKey: string;
    displayName: string;
    description?: string;
    scopes: string[];
    audience: string;
    status: "active" | "disabled";
  }) {
    const result = await createResourceMutation.mutateAsync({ appId, resource });
    await queryClient.invalidateQueries({ queryKey: queryKeys.appOverview(appId) });
    apps = apps.map((app) =>
      app.id === appId
        ? { ...app, resources: [...(app.resources || []), result.resource] }
        : app,
    );
    appBundles = Object.fromEntries(
      Object.entries(appBundles).filter(([key]) => key !== appId),
    );
    await loadSelectedApp(appId);
  }

  async function handleDeleteResource(appId: string, resourceId: string) {
    await deleteResourceMutation.mutateAsync({ appId, resourceId });
    await queryClient.invalidateQueries({ queryKey: queryKeys.appOverview(appId) });
    apps = apps.map((app) =>
      app.id === appId
        ? { ...app, resources: (app.resources || []).filter((resource) => resource.id !== resourceId) }
        : app,
    );
    appBundles = Object.fromEntries(
      Object.entries(appBundles).filter(([key]) => key !== appId),
    );
    await loadSelectedApp(appId);
  }

  async function handleInvite(email: string, role: WorkspaceRole) {
    if (!workspace) return;
    const organizationId = workspace.id;

    try {
      await inviteMemberMutation.mutateAsync({ organizationId, email, role });
      const refreshedWorkspace = await queryClient.fetchQuery({
        queryKey: queryKeys.workspace(organizationId),
        queryFn: () => fetchOrganization(organizationId),
      });
      workspace = refreshedWorkspace;
      organizations = organizations.map((organization) =>
        organization.id === refreshedWorkspace.id
          ? { ...organization, memberCount: refreshedWorkspace.members.filter((member) => member.status === "active").length }
          : organization,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to invite member";
    }
  }

  async function handleRoleChange(memberId: string, role: WorkspaceRole) {
    if (!workspace) return;
    const organizationId = workspace.id;

    try {
      await updateMemberRoleMutation.mutateAsync({ organizationId, memberId, role });
      workspace = await queryClient.fetchQuery({
        queryKey: queryKeys.workspace(organizationId),
        queryFn: () => fetchOrganization(organizationId),
      });
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update role";
    }
  }

  async function handleWorkspaceRename(name: string) {
    if (!workspace) return;

    try {
      const updated = await updateOrganizationMutation.mutateAsync({
        organizationId: workspace.id,
        data: { name },
      });
      workspace = {
        ...workspace,
        name: updated.name,
        logoUrl: updated.logoUrl,
      };
      organizations = organizations.map((organization) =>
        organization.id === workspace?.id
          ? { ...organization, name: updated.name, logoUrl: updated.logoUrl }
          : organization,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update workspace";
    }
  }

  async function handleDomainAdd(domain: string) {
    if (!workspace) return;

    try {
      const verifiedDomains = [...workspace.verifiedDomains, domain];
      const updated = await updateOrganizationMutation.mutateAsync({
        organizationId: workspace.id,
        data: { verifiedDomains },
      });
      workspace = {
        ...workspace,
        logoUrl: updated.logoUrl,
        verifiedDomains: updated.verifiedDomains,
      };
      organizations = organizations.map((organization) =>
        organization.id === workspace?.id
          ? { ...organization, verifiedDomains: updated.verifiedDomains, logoUrl: updated.logoUrl }
          : organization,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to add domain";
    }
  }

  async function handleWorkspaceLogoUpload(file: File) {
    if (!workspace) return;

    try {
      const result = await uploadWorkspaceLogoMutation.mutateAsync({ organizationId: workspace.id, file });
      workspace = {
        ...workspace,
        logoUrl: result.logoUrl,
      };
      organizations = organizations.map((organization) =>
        organization.id === workspace?.id
          ? { ...organization, logoUrl: result.logoUrl }
          : organization,
      );
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to upload workspace logo";
    }
  }

  async function handleCreateOrganization() {
    const name = newOrganizationName.trim();
    if (!name) return;

    creatingOrganization = true;

    try {
      const result = await createOrganizationMutation.mutateAsync(name);
      newOrganizationName = "";
      createOrganizationModalOpen = false;
      await loadPortal(result.organization.id);
      workspaceSection = "organization";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create organization";
    } finally {
      creatingOrganization = false;
    }
  }
</script>

<PortalView
  {authenticated}
  {loading}
  {workspace}
  {currentOrganizationId}
  {organizations}
  {apps}
  {selectedAppId}
  {selectedApp}
  {appNav}
  {workspaceNav}
  {appSection}
  bind:workspaceSection
  bind:deleteTarget
  {deleting}
  bind:error
  bind:newSecret
  bind:createModalOpen
  bind:createOrganizationModalOpen
  bind:newOrganizationName
  {creating}
  {creatingOrganization}
  {appLoading}
  {appInsights}
  {appIdentities}
  {appEvents}
  {appIdentitiesTotal}
  {appEventsTotal}
  {appIdentitiesLoadingMore}
  {appEventsLoadingMore}
  {appEventsHasMore}
  {saveState}
  {rotatingAppId}
  {rotatedAppId}
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
