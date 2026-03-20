<script lang="ts">
  import { onMount } from "svelte";
  import AuroraBackdrop from "./components/AuroraBackdrop.svelte";
  import DeleteModal from "./components/DeleteModal.svelte";
  import SecretBanner from "./components/SecretBanner.svelte";
  import SignInPage from "./pages/SignInPage.svelte";
  import AppsPage from "./pages/AppsPage.svelte";
  import TeamPage from "./pages/TeamPage.svelte";
  import CreateAppPage from "./pages/CreateAppPage.svelte";
  import AppDetailPage from "./pages/AppDetailPage.svelte";
  import AppOverviewPage from "./pages/AppOverviewPage.svelte";
  import AppIdentitiesPage from "./pages/AppIdentitiesPage.svelte";
  import AppActivityPage from "./pages/AppActivityPage.svelte";
  import Input from "./components/Input.svelte";
  import TopBar from "./components/TopBar.svelte";
  import Subnav from "./components/Subnav.svelte";
  import {
    checkSession,
    createOrganization,
    createApp,
    createResource,
    deleteApp,
    deleteResource,
    fetchAppOverview,
    fetchApps,
    fetchOrganization,
    fetchOrganizations,
    inviteOrganizationMember,
    logoutSession,
    rotateSecret,
    updateApp,
    updateOrganization,
    updateOrganizationMemberRole,
    uploadWorkspaceLogo,
    ApiError,
    type AppEvent,
    type AppIdentityRecord,
    type AppInsightSnapshot,
    type AppOverviewBundle,
    type DevApp,
  } from "./lib/api";
  import type { WorkspaceRole, WorkspaceState, WorkspaceSummary } from "./lib/portal";

  type WorkspaceSection = "applications" | "organization";
  type AppSection = "overview" | "identities" | "activity" | "configure";

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
    { id: "identities", label: "Identities", badge: appIdentities.length },
    { id: "activity", label: "Activity" },
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
    const hasSession = await checkSession();
    authenticated = hasSession;

    if (hasSession) {
      await loadPortal();
    }

    loading = false;
  }

  async function loadPortal(targetOrganizationId?: string) {
    loading = true;

    try {
      const organizationResponse = await fetchOrganizations(targetOrganizationId);
      organizations = organizationResponse.organizations;
      currentOrganizationId = organizationResponse.currentOrganizationId;

      if (!currentOrganizationId) {
        workspace = null;
        apps = [];
        return;
      }

      const [nextWorkspace, nextApps] = await Promise.all([
        fetchOrganization(currentOrganizationId),
        fetchApps(currentOrganizationId),
      ]);

      workspace = nextWorkspace;
      apps = nextApps;

      if (selectedAppId && !nextApps.some((app) => app.id === selectedAppId)) {
        selectedAppId = null;
        appInsights = null;
        appIdentities = [];
        appEvents = [];
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        authenticated = false;
        apps = [];
        workspace = null;
        organizations = [];
        currentOrganizationId = null;
      }
      error = err instanceof Error ? err.message : "Failed to load portal";
    } finally {
      loading = false;
    }
  }

  async function loadSelectedApp(appId: string) {
    const cachedBundle = appBundles[appId];

    if (cachedBundle) {
      applyAppBundle(cachedBundle);
      appLoading = false;
    } else {
      appInsights = null;
      appIdentities = [];
      appEvents = [];
      appLoading = true;
    }

    try {
      const bundle = await fetchAppOverview(appId);
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
      }
      error = err instanceof Error ? err.message : "Failed to load app overview";
    } finally {
      if (selectedAppId === appId) {
        appLoading = false;
      }
    }
  }

  function applyAppBundle(bundle: AppOverviewBundle) {
    appInsights = bundle.insights;
    appIdentities = bundle.identities;
    appEvents = bundle.events;
  }

  function handleSignIn() {
    window.location.href = "https://aveid.net/login";
  }

  async function handleSignOut() {
    try {
      await logoutSession();
    } catch {
      error = "Failed to sign out";
      return;
    }

    authenticated = false;
    organizations = [];
    currentOrganizationId = null;
    workspace = null;
    apps = [];
    selectedAppId = null;
    appInsights = null;
    appIdentities = [];
    appEvents = [];
    deleteTarget = null;
    createModalOpen = false;
    createOrganizationModalOpen = false;
    newSecret = null;
    workspaceSection = "applications";
    appSection = "overview";
  }

  function openWorkspace(section: WorkspaceSection) {
    selectedAppId = null;
    appInsights = null;
    appIdentities = [];
    appEvents = [];
    createModalOpen = false;
    createOrganizationModalOpen = false;
    workspaceSection = section;
  }

  async function switchOrganization(organizationId: string) {
    selectedAppId = null;
    appInsights = null;
    appIdentities = [];
    appEvents = [];
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

  async function handleCreate(form: {
    name: string;
    description: string;
    websiteUrl: string;
    iconUrl: string;
    redirectUris: string;
    supportsE2ee: boolean;
    allowUserIdScope: boolean;
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

      const result = await createApp({
        name: form.name,
        description: form.description || undefined,
        websiteUrl: form.websiteUrl || undefined,
        iconUrl: form.iconUrl || undefined,
        redirectUris,
        supportsE2ee: form.supportsE2ee,
        allowUserIdScope: form.allowUserIdScope,
        accessTokenTtlSeconds: form.accessTokenTtlSeconds,
        refreshTokenTtlSeconds: form.refreshTokenTtlSeconds,
        allowedScopes: form.allowedScopes,
        organizationId: currentOrganizationId,
      });

      apps = [result.app, ...apps];
      newSecret = result.clientSecret;
      appBundles = {};
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
      const result = await rotateSecret(appId);
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

    try {
      const payload = {
        name: app.name,
        description: app.description || undefined,
        websiteUrl: app.websiteUrl || undefined,
        iconUrl: app.iconUrl || undefined,
        redirectUris: (app.redirectUrisText || "")
          .split("\n")
          .map((uri) => uri.trim())
          .filter(Boolean),
        supportsE2ee: app.supportsE2ee,
        allowedScopes: app.allowedScopes,
        accessTokenTtlSeconds: app.accessTokenTtlSeconds,
        refreshTokenTtlSeconds: app.refreshTokenTtlSeconds,
        allowUserIdScope: app.allowUserIdScope,
      };

      const result = await updateApp(app.id, payload);
      apps = apps.map((entry) => (entry.id === result.app.id ? result.app : entry));
      appBundles = Object.fromEntries(
        Object.entries(appBundles).filter(([key]) => key !== app.id),
      );
      await loadSelectedApp(app.id);
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
      await deleteApp(target.id);
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
    const result = await createResource(appId, resource);
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
    await deleteResource(appId, resourceId);
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

    try {
      await inviteOrganizationMember(workspace.id, { email, role });
      const refreshedWorkspace = await fetchOrganization(workspace.id);
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

    try {
      await updateOrganizationMemberRole(workspace.id, memberId, role);
      workspace = await fetchOrganization(workspace.id);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update role";
    }
  }

  async function handleWorkspaceRename(name: string) {
    if (!workspace) return;

    try {
      const updated = await updateOrganization(workspace.id, { name });
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
      const updated = await updateOrganization(workspace.id, { verifiedDomains });
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
      const result = await uploadWorkspaceLogo(workspace.id, file);
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
      const result = await createOrganization(name);
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

{#if !authenticated}
  <SignInPage onsignin={handleSignIn} {loading} />
{:else if workspace && currentOrganizationId}
  <div class="relative min-h-screen bg-[#090909]">
    <AuroraBackdrop preset="dashboard-tr" cclass="pointer-events-none absolute right-0 top-0 w-[70%] select-none" />
    <AuroraBackdrop preset="dashboard-bl" cclass="pointer-events-none absolute bottom-0 left-0 w-[80%] select-none" />

    <div class="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-5 px-3 py-3 md:px-5 md:py-5">
      <TopBar
        {workspace}
        {organizations}
        {currentOrganizationId}
        {apps}
        {selectedAppId}
        onselectorganization={switchOrganization}
        onselectapp={openApp}
        onopenapps={() => openWorkspace("applications")}
        onopenteam={() => openWorkspace("organization")}
        oncreateorganization={() => (createOrganizationModalOpen = true)}
        oncreateapp={() => (createModalOpen = true)}
        onsignout={handleSignOut}
      />

      <div class="rounded-[28px] bg-[#0d0d0d]/76 px-4 md:px-6 backdrop-blur-[24px]">
        {#if selectedAppId}
          <Subnav items={appNav} active={appSection} onselect={(id) => (appSection = id as AppSection)} />
        {:else}
          <Subnav items={workspaceNav} active={workspaceSection} onselect={(id) => (workspaceSection = id as WorkspaceSection)} />
        {/if}
      </div>

      {#if deleteTarget}
        <DeleteModal
          appName={deleteTarget.name}
          onconfirm={handleConfirmDelete}
          oncancel={() => {
            if (!deleting) deleteTarget = null;
          }}
          {deleting}
        />
      {/if}

      {#if error}
        <div class="flex items-center justify-between gap-4 rounded-full bg-[#e14747]/10 px-6 py-3 text-[15px] text-[#e14747]">
          <span>{error}</span>
          <button
            class="border-0 bg-transparent text-[14px] text-[#e14747]/70 cursor-pointer hover:text-[#e14747]"
            onclick={() => (error = "")}
          >dismiss</button>
        </div>
      {/if}

      {#if newSecret}
        <SecretBanner secret={newSecret} ondismiss={() => (newSecret = null)} />
      {/if}

      {#if createModalOpen}
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div class="max-h-[calc(100vh-48px)] w-full max-w-[980px] overflow-y-auto rounded-[32px] bg-[#131313] p-6 md:p-8 shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
            <CreateAppPage
              oncreate={handleCreate}
              oncancel={() => (createModalOpen = false)}
              {creating}
            />
          </div>
        </div>
      {/if}

      {#if createOrganizationModalOpen}
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div class="w-full max-w-[560px] rounded-[32px] bg-[#131313] p-6 md:p-8 shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
            <div class="flex flex-col gap-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h2 class="m-0 text-[28px] font-black tracking-tight text-white">Create organization</h2>
                  <p class="m-0 mt-2 text-[15px] text-[#7d7d7d]">Start a separate workspace for another team or product.</p>
                </div>
                <button aria-label="Close create organization modal" class="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-white/[0.04] text-[#9a9a9a] cursor-pointer transition-colors duration-300 hover:bg-white/[0.08] hover:text-white" onclick={() => {
                  createOrganizationModalOpen = false;
                  newOrganizationName = "";
                }}>
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <label class="flex flex-col gap-3">
                <span class="text-[14px] text-[#8a8a8a]">Organization name</span>
                <Input bind:value={newOrganizationName} placeholder="New workspace" />
              </label>

              <div class="flex justify-end gap-3">
                <button class="rounded-full border-0 bg-transparent px-5 py-2.5 text-[14px] text-[#8d8d8d] cursor-pointer transition-colors duration-300 hover:bg-white/[0.04] hover:text-white" onclick={() => {
                  createOrganizationModalOpen = false;
                  newOrganizationName = "";
                }}>Cancel</button>
                <button class="rounded-full border-0 bg-[#B9BBBE] px-5 py-2.5 text-[14px] font-black text-[#090909] cursor-pointer transition-colors duration-300 hover:bg-[#A1A1A1] disabled:opacity-50 disabled:pointer-events-none" onclick={handleCreateOrganization} disabled={creatingOrganization || !newOrganizationName.trim()}>
                  {creatingOrganization ? "Creating..." : "Create organization"}
                </button>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <main class="flex-1 px-0 py-1 md:py-2">
        {#if selectedApp && appLoading && !appInsights && appSection !== "configure"}
          <div class="flex flex-col gap-5">
            <div class="flex items-center gap-4">
              <div class="h-12 w-12 rounded-[18px] bg-white/[0.05] animate-pulse"></div>
              <div class="flex flex-col gap-2">
                <div class="h-5 w-40 rounded-full bg-white/[0.05] animate-pulse"></div>
                <div class="h-4 w-64 rounded-full bg-white/[0.04] animate-pulse"></div>
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {#each Array.from({ length: 4 }) as _, index (index)}
                <div class="rounded-[28px] bg-white/[0.03] p-6">
                  <div class="h-4 w-24 rounded-full bg-white/[0.05] animate-pulse"></div>
                  <div class="mt-5 h-10 w-20 rounded-full bg-white/[0.06] animate-pulse"></div>
                  <div class="mt-4 h-4 w-32 rounded-full bg-white/[0.04] animate-pulse"></div>
                </div>
              {/each}
            </div>
            <div class="grid gap-4 xl:grid-cols-2">
              {#each Array.from({ length: 2 }) as _, index (index)}
                <div class="rounded-[28px] bg-white/[0.03] p-6">
                  <div class="h-5 w-36 rounded-full bg-white/[0.05] animate-pulse"></div>
                  <div class="mt-6 space-y-3">
                    {#each Array.from({ length: 3 }) as __, itemIndex (itemIndex)}
                      <div class="h-16 rounded-[20px] bg-white/[0.04] animate-pulse"></div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else if selectedApp && appInsights && appSection === "overview"}
          <AppOverviewPage app={selectedApp} insights={appInsights} identities={appIdentities} events={appEvents} />
        {:else if selectedApp && appSection === "identities"}
          <AppIdentitiesPage identities={appIdentities} />
        {:else if selectedApp && appInsights && appSection === "activity"}
          <AppActivityPage app={selectedApp} insights={appInsights} events={appEvents} />
        {:else if selectedApp && appSection === "configure"}
          <AppDetailPage
            app={selectedApp}
            onsave={handleSaveApp}
            onrotate={handleRotateSecret}
            ondelete={(app) => (deleteTarget = app)}
            oncreateResource={handleCreateResource}
            ondeleteResource={handleDeleteResource}
            oncopy={handleCopy}
            saving={saveState === "saving"}
            saved={saveState === "saved"}
            rotating={rotatingAppId === selectedApp.id}
            rotated={rotatedAppId === selectedApp.id}
          />
        {:else if workspaceSection === "applications"}
          <AppsPage
            {apps}
            {loading}
            oncreate={() => (createModalOpen = true)}
            onselect={(app) => openApp(app.id)}
          />
        {:else if workspaceSection === "organization"}
          <TeamPage
            {workspace}
            oninvite={handleInvite}
            onchangerole={handleRoleChange}
            onuploadlogo={handleWorkspaceLogoUpload}
            onrename={handleWorkspaceRename}
          />
        {/if}
      </main>
    </div>
  </div>
{:else if authenticated}
  <div class="relative min-h-screen bg-[#090909]">
    <AuroraBackdrop preset="dashboard-tr" cclass="pointer-events-none absolute right-0 top-0 w-[70%] select-none" />
    <AuroraBackdrop preset="dashboard-bl" cclass="pointer-events-none absolute bottom-0 left-0 w-[80%] select-none" />

    <div class="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-5 px-3 py-3 md:px-5 md:py-5">
      <div class="rounded-[30px] bg-[#0d0d0d]/88 px-5 py-5 backdrop-blur-[24px]">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="h-14 w-14 rounded-full bg-white/[0.05] animate-pulse"></div>
            <div class="space-y-2">
              <div class="h-5 w-40 rounded-full bg-white/[0.05] animate-pulse"></div>
              <div class="h-4 w-28 rounded-full bg-white/[0.04] animate-pulse"></div>
            </div>
          </div>
          <div class="h-11 w-11 rounded-full bg-white/[0.05] animate-pulse"></div>
        </div>
      </div>

      <div class="rounded-[32px] bg-[#0d0d0d]/76 px-5 py-8 md:px-8 md:py-10 backdrop-blur-[24px]">
        <div class="space-y-5">
          <div class="h-6 w-40 rounded-full bg-white/[0.05] animate-pulse"></div>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {#each Array.from({ length: 6 }) as _, index (index)}
              <div class="h-[220px] rounded-[28px] bg-white/[0.03] animate-pulse"></div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
