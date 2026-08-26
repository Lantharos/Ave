<script lang="ts">
  import AuroraBackdrop from "$lib/components/AuroraBackdrop.svelte";
  import DeleteModal from "$lib/surfaces/devs/components/DeleteModal.svelte";
  import SecretBanner from "$lib/surfaces/devs/components/SecretBanner.svelte";
  import Input from "$lib/surfaces/devs/components/Input.svelte";
  import TopBar from "$lib/surfaces/devs/components/TopBar.svelte";
  import Subnav from "$lib/surfaces/devs/components/Subnav.svelte";
  import { lazyModule } from "$lib/infrastructure/ui/lazy-module";
  import type {
    AppEvent,
    AppIdentityRecord,
    AppInsightSnapshot,
    DevApp,
  } from "$lib/surfaces/devs/lib/api";
  import type { WorkspaceRole, WorkspaceState, WorkspaceSummary } from "$lib/surfaces/devs/lib/portal";

  type WorkspaceSection = "applications" | "organization";
  type AppSection = "overview" | "identities" | "activity" | "configure";
  type NavItem = { id: string; label: string; badge?: number };

  const loadSignInPage = lazyModule(() => import("./SignInPage.svelte"));
  const loadAppsPage = lazyModule(() => import("./AppsPage.svelte"));
  const loadTeamPage = lazyModule(() => import("./TeamPage.svelte"));
  const loadCreateAppPage = lazyModule(() => import("./CreateAppPage.svelte"));
  const loadAppDetailPage = lazyModule(() => import("./AppDetailPage.svelte"));
  const loadAppOverviewPage = lazyModule(() => import("./AppOverviewPage.svelte"));
  const loadAppIdentitiesView = lazyModule(() => import("./AppIdentitiesPage.svelte"));
  const loadAppActivityView = lazyModule(() => import("./AppActivityPage.svelte"));

  let {
    authenticated,
    loading,
    workspace,
    currentOrganizationId,
    organizations,
    apps,
    selectedAppId,
    selectedApp,
    appNav,
    workspaceNav,
    appSection,
    workspaceSection = $bindable(),
    deleteTarget = $bindable(),
    deleting,
    error = $bindable(),
    newSecret = $bindable(),
    createModalOpen = $bindable(),
    createOrganizationModalOpen = $bindable(),
    newOrganizationName = $bindable(),
    creating,
    creatingOrganization,
    appLoading,
    appInsights,
    appIdentities,
    appEvents,
    appIdentitiesTotal,
    appEventsTotal,
    appIdentitiesLoadingMore,
    appEventsLoadingMore,
    appEventsHasMore,
    saveState,
    rotatingAppId,
    rotatedAppId,
    handleSignIn,
    openAveDashboard,
    openWorkspace,
    switchOrganization,
    openApp,
    handleAppSectionSelect,
    handleConfirmDelete,
    handleCreate,
    handleCreateOrganization,
    loadAppIdentitiesPage,
    loadAppActivityPage,
    handleSaveApp,
    handleRotateSecret,
    handleCreateResource,
    handleDeleteResource,
    handleCopy,
    handleInvite,
    handleRoleChange,
    handleWorkspaceLogoUpload,
    handleWorkspaceRename,
  }: {
    authenticated: boolean;
    loading: boolean;
    workspace: WorkspaceState | null;
    currentOrganizationId: string | null;
    organizations: WorkspaceSummary[];
    apps: DevApp[];
    selectedAppId: string | null;
    selectedApp: (DevApp & { redirectUrisText: string }) | null;
    appNav: NavItem[];
    workspaceNav: NavItem[];
    appSection: AppSection;
    workspaceSection: WorkspaceSection;
    deleteTarget: DevApp | null;
    deleting: boolean;
    error: string;
    newSecret: string | null;
    createModalOpen: boolean;
    createOrganizationModalOpen: boolean;
    newOrganizationName: string;
    creating: boolean;
    creatingOrganization: boolean;
    appLoading: boolean;
    appInsights: AppInsightSnapshot | null;
    appIdentities: AppIdentityRecord[];
    appEvents: AppEvent[];
    appIdentitiesTotal: number;
    appEventsTotal: number;
    appIdentitiesLoadingMore: boolean;
    appEventsLoadingMore: boolean;
    appEventsHasMore: boolean;
    saveState: "idle" | "saving" | "saved";
    rotatingAppId: string | null;
    rotatedAppId: string | null;
    handleSignIn: () => void;
    openAveDashboard: () => void;
    openWorkspace: (section: WorkspaceSection) => void;
    switchOrganization: (id: string) => Promise<void>;
    openApp: (id: string | null) => Promise<void>;
    handleAppSectionSelect: (id: string) => void;
    handleConfirmDelete: () => Promise<void>;
    handleCreate: (form: {
      name: string; description: string; websiteUrl: string; iconUrl: string;
      redirectUris: string; developmentMode: boolean; accessTokenTtlSeconds: number;
      refreshTokenTtlSeconds: number; allowedScopes: string[];
    }) => Promise<void>;
    handleCreateOrganization: () => Promise<void>;
    loadAppIdentitiesPage: (appId: string, reset?: boolean) => Promise<void>;
    loadAppActivityPage: (appId: string, reset?: boolean) => Promise<void>;
    handleSaveApp: (app: DevApp & { redirectUrisText?: string }) => Promise<void>;
    handleRotateSecret: (appId: string) => Promise<void>;
    handleCreateResource: (appId: string, resource: {
      resourceKey: string; displayName: string; description?: string; scopes: string[];
      audience: string; status: "active" | "disabled";
    }) => Promise<void>;
    handleDeleteResource: (appId: string, resourceId: string) => Promise<void>;
    handleCopy: (text: string) => Promise<void>;
    handleInvite: (email: string, role: WorkspaceRole) => Promise<void>;
    handleRoleChange: (memberId: string, role: WorkspaceRole) => Promise<void>;
    handleWorkspaceLogoUpload: (file: File) => Promise<void>;
    handleWorkspaceRename: (name: string) => Promise<void>;
  } = $props();
</script>

{#if !authenticated}
  {#await loadSignInPage() then { default: SignInPage }}
    <SignInPage onsignin={handleSignIn} {loading} />
  {/await}
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
        onopenaccount={openAveDashboard}
      />

      <div class="rounded-[28px] bg-[#0d0d0d]/76 px-4 md:px-6 backdrop-blur-[24px]">
        {#if selectedAppId}
          <Subnav items={appNav} active={appSection} onselect={handleAppSectionSelect} />
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
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="button"
          tabindex="0"
          onclick={(event) => {
            if (event.currentTarget === event.target && !creating) {
              createModalOpen = false;
            }
          }}
          onkeydown={(event) => {
            if (event.currentTarget === event.target && (event.key === "Escape" || event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              if (!creating) {
                createModalOpen = false;
              }
            }
          }}
        >
          <div class="hide-scrollbar max-h-[calc(100vh-48px)] w-full max-w-[980px] overflow-y-auto rounded-[32px] bg-[#131313] p-6 md:p-8 shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
            {#await loadCreateAppPage() then { default: CreateAppPage }}
              <CreateAppPage
                oncreate={handleCreate}
                oncancel={() => (createModalOpen = false)}
                {creating}
              />
            {/await}
          </div>
        </div>
      {/if}

      {#if createOrganizationModalOpen}
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="button"
          tabindex="0"
          onclick={(event) => {
            if (event.currentTarget !== event.target) return;
            createOrganizationModalOpen = false;
            newOrganizationName = "";
          }}
          onkeydown={(event) => {
            if (event.currentTarget !== event.target) return;
            if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              createOrganizationModalOpen = false;
              newOrganizationName = "";
            }
          }}
        >
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
              <div class="h-12 w-12 rounded-[18px] bg-[#141414] animate-pulse"></div>
              <div class="flex flex-col gap-2">
                <div class="h-5 w-40 rounded-full bg-[#171717] animate-pulse"></div>
                <div class="h-4 w-64 rounded-full bg-[#151515] animate-pulse"></div>
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {#each Array.from({ length: 4 }) as _, index (index)}
                <div class="rounded-[28px] bg-[#111111] p-6">
                  <div class="h-4 w-24 rounded-full bg-[#171717] animate-pulse"></div>
                  <div class="mt-5 h-10 w-20 rounded-full bg-[#1a1a1a] animate-pulse"></div>
                  <div class="mt-4 h-4 w-32 rounded-full bg-[#151515] animate-pulse"></div>
                </div>
              {/each}
            </div>
            <div class="grid gap-4 xl:grid-cols-2">
              {#each Array.from({ length: 2 }) as _, index (index)}
                <div class="rounded-[28px] bg-[#111111] p-6">
                  <div class="h-5 w-36 rounded-full bg-[#171717] animate-pulse"></div>
                  <div class="mt-6 space-y-3">
                    {#each Array.from({ length: 3 }) as __, itemIndex (itemIndex)}
                      <div class="h-16 rounded-[20px] bg-[#151515] animate-pulse"></div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else if selectedApp && appInsights && appSection === "overview"}
          {#await loadAppOverviewPage() then { default: AppOverviewPage }}
            <AppOverviewPage app={selectedApp} insights={appInsights} identities={appIdentities} events={appEvents} />
          {/await}
        {:else if selectedApp && appSection === "identities"}
          {#await loadAppIdentitiesView() then { default: AppIdentitiesPage }}
            <AppIdentitiesPage
              identities={appIdentities}
              total={appIdentitiesTotal}
              loadingmore={appIdentitiesLoadingMore}
              hasmore={appIdentities.length < appIdentitiesTotal}
              onloadmore={() => loadAppIdentitiesPage(selectedApp.id)}
            />
          {/await}
        {:else if selectedApp && appInsights && appSection === "activity"}
          {#await loadAppActivityView() then { default: AppActivityPage }}
            <AppActivityPage
              app={selectedApp}
              insights={appInsights}
              events={appEvents}
              total={appEventsTotal}
              loadingmore={appEventsLoadingMore}
              hasmore={appEventsHasMore}
              onloadmore={() => loadAppActivityPage(selectedApp.id)}
            />
          {/await}
        {:else if selectedApp && appSection === "configure"}
          {#await loadAppDetailPage() then { default: AppDetailPage }}
            <AppDetailPage
              app={selectedApp}
              {organizations}
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
          {/await}
        {:else if workspaceSection === "applications"}
          {#await loadAppsPage() then { default: AppsPage }}
            <AppsPage
              {apps}
              {loading}
              oncreate={() => (createModalOpen = true)}
              onselect={(app) => openApp(app.id)}
            />
          {/await}
        {:else if workspaceSection === "organization"}
          {#await loadTeamPage() then { default: TeamPage }}
            <TeamPage
              {workspace}
              oninvite={handleInvite}
              onchangerole={handleRoleChange}
              onuploadlogo={handleWorkspaceLogoUpload}
              onrename={handleWorkspaceRename}
            />
          {/await}
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
            <div class="h-14 w-14 rounded-full bg-[#141414] animate-pulse"></div>
            <div class="space-y-2">
              <div class="h-5 w-40 rounded-full bg-[#171717] animate-pulse"></div>
              <div class="h-4 w-28 rounded-full bg-[#151515] animate-pulse"></div>
            </div>
          </div>
          <div class="h-11 w-11 rounded-full bg-[#141414] animate-pulse"></div>
        </div>
      </div>

      <div class="rounded-[32px] bg-[#0d0d0d]/76 px-5 py-8 md:px-8 md:py-10 backdrop-blur-[24px]">
        <div class="space-y-5">
          <div class="h-6 w-40 rounded-full bg-[#171717] animate-pulse"></div>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {#each Array.from({ length: 6 }) as _, index (index)}
              <div class="h-[220px] rounded-[28px] bg-[#111111] animate-pulse"></div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
