<script lang="ts">
  import { onMount } from "svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import SecretBanner from "./components/SecretBanner.svelte";
  import DeleteModal from "./components/DeleteModal.svelte";
  import SignInPage from "./pages/SignInPage.svelte";
  import OverviewPage from "./pages/OverviewPage.svelte";
  import AppsPage from "./pages/AppsPage.svelte";
  import CreateAppPage from "./pages/CreateAppPage.svelte";
  import AppDetailPage from "./pages/AppDetailPage.svelte";
  import ActivityPage from "./pages/ActivityPage.svelte";
  import SettingsPage from "./pages/SettingsPage.svelte";
  import {
    fetchApps,
    createApp,
    updateApp,
    deleteApp,
    rotateSecret,
    checkSession,
    logoutSession,
    type DevApp,
  } from "./lib/api";
  import { defaultScopes } from "./lib/types";

  type View = "overview" | "apps" | "create" | "activity" | "settings" | "app";

  let activeView: View = $state("overview");
  let apps: DevApp[] = $state([]);
  let selectedApp: (DevApp & { redirectUrisText?: string }) | null = $state(null);
  let deleteTarget: DevApp | null = $state(null);
  let loading = $state(true);
  let error = $state("");
  let authenticated = $state(false);
  let newSecret: string | null = $state(null);
  let creating = $state(false);

  onMount(() => {
    init();

    let resuming = false;
    const handleResume = async () => {
      if (document.visibilityState !== "visible" || resuming) return;
      resuming = true;
      try {
        if (authenticated) await loadApps();
      } finally {
        resuming = false;
      }
    };

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);

    return () => {
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("focus", handleResume);
    };
  });

  async function init() {
    loading = true;
    const hasSession = await checkSession();
    authenticated = hasSession;
    if (hasSession) {
      await loadApps();
    }
    loading = false;
  }

  async function loadApps() {
    loading = true;
    try {
      apps = await fetchApps();
    } catch {
      authenticated = false;
      apps = [];
    } finally {
      loading = false;
    }
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
    apps = [];
    selectedApp = null;
    deleteTarget = null;
    newSecret = null;
    activeView = "overview";
  }

  function navigate(view: View) {
    activeView = view;
    newSecret = null;
  }

  function openApp(app: DevApp) {
    selectedApp = {
      ...app,
      redirectUrisText: app.redirectUris.join("\n"),
    };
    activeView = "app";
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
      });

      apps = [result.app, ...apps];
      newSecret = result.clientSecret;
      activeView = "apps";
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create app";
    } finally {
      creating = false;
    }
  }

  async function handleRotateSecret(appId: string) {
    error = "";
    try {
      const result = await rotateSecret(appId);
      newSecret = result.clientSecret;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to rotate secret";
    }
  }

  async function handleSaveApp() {
    if (!selectedApp) return;
    error = "";
    try {
      const payload = {
        name: selectedApp.name,
        description: selectedApp.description || undefined,
        websiteUrl: selectedApp.websiteUrl || undefined,
        iconUrl: selectedApp.iconUrl || undefined,
        redirectUris: (selectedApp.redirectUrisText || "")
          .split("\n")
          .map((uri) => uri.trim())
          .filter(Boolean),
        supportsE2ee: selectedApp.supportsE2ee,
        allowedScopes: selectedApp.allowedScopes,
        accessTokenTtlSeconds: selectedApp.accessTokenTtlSeconds,
        refreshTokenTtlSeconds: selectedApp.refreshTokenTtlSeconds,
        allowUserIdScope: selectedApp.allowUserIdScope,
      };

      const result = await updateApp(selectedApp.id, payload);
      apps = apps.map((a) => (a.id === result.app.id ? result.app : a));
      selectedApp = {
        ...result.app,
        redirectUrisText: result.app.redirectUris.join("\n"),
      };
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update app";
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    error = "";
    const target = deleteTarget;
    try {
      await deleteApp(target.id);
      apps = apps.filter((a) => a.id !== target.id);
      if (selectedApp?.id === target.id) {
        activeView = "apps";
        selectedApp = null;
      }
      deleteTarget = null;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to delete app";
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      error = "Failed to copy to clipboard";
    }
  }
</script>

{#if !authenticated}
  <SignInPage onsignin={handleSignIn} {loading} />
{:else}
  <div class="bg-[#090909] relative w-full min-h-screen flex flex-col md:flex-row px-3 md:px-[120px] py-4 md:py-[100px] gap-4 md:gap-[100px]">
    <Sidebar
      {activeView}
      onnavigate={navigate}
      onsignout={handleSignOut}
    />

    <main class="w-full md:w-[75%] flex flex-col gap-8">
      {#if deleteTarget}
        <DeleteModal
          appName={deleteTarget.name}
          onconfirm={handleConfirmDelete}
          oncancel={() => (deleteTarget = null)}
        />
      {/if}

      {#if error}
        <div class="bg-[#e14747]/10 rounded-full px-6 py-3 text-[16px] text-[#e14747] flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            class="text-[#e14747]/60 hover:text-[#e14747] border-0 bg-transparent cursor-pointer text-[14px] underline"
            onclick={() => (error = "")}
          >dismiss</button>
        </div>
      {/if}

      {#if newSecret}
        <SecretBanner secret={newSecret} ondismiss={() => (newSecret = null)} />
      {/if}

      {#if activeView === "overview"}
        <OverviewPage {apps} oncreate={() => navigate("create")} />
      {:else if activeView === "apps"}
        <AppsPage
          {apps}
          {loading}
          oncreate={() => navigate("create")}
          onselect={openApp}
          onrotate={handleRotateSecret}
        />
      {:else if activeView === "create"}
        <CreateAppPage
          oncreate={handleCreate}
          oncancel={() => navigate("apps")}
          {creating}
        />
      {:else if activeView === "app" && selectedApp}
        <AppDetailPage
          bind:app={selectedApp}
          onsave={handleSaveApp}
          onrotate={handleRotateSecret}
          ondelete={(app) => (deleteTarget = app)}
          onback={() => navigate("apps")}
          oncopy={handleCopy}
        />
      {:else if activeView === "activity"}
        <ActivityPage />
      {:else if activeView === "settings"}
        <SettingsPage />
      {/if}
    </main>
  </div>
{/if}
