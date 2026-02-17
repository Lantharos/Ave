<script lang="ts">
  import { goto } from "@mateothegreat/svelte5-router";
  import { get } from "svelte/store";
  import Text from "../../components/Text.svelte";
  import AuroraBackdrop from "../../components/AuroraBackdrop.svelte";
  import { api } from "../../lib/api";
  import { auth, isAuthenticated } from "../../stores/auth";
  import { setReturnUrl } from "../../util/return-url";
  import { safeGoto } from "../../util/safe-goto";

  type Resource = {
    resourceKey: string;
    displayName: string;
    description?: string;
    scopes: string[];
    audience: string;
    status: string;
  };

  let loading = $state(true);
  let connecting = $state(false);
  let error = $state<string | null>(null);

  let appInfo = $state<{
    name: string;
    description?: string;
    iconUrl?: string;
    websiteUrl?: string;
  } | null>(null);

  let resources = $state<Resource[]>([]);
  let selectedResourceKey = $state("");
  let selectedScope = $state("");
  let communicationMode = $state<"user_present" | "background">("user_present");
  let selectedIdentityId = $state("");

  const params = $derived.by(() => {
    const p = new URLSearchParams(window.location.search);
    return {
      clientId: p.get("client_id") || "",
      redirectUri: p.get("redirect_uri") || "",
      state: p.get("state") || "",
      resource: p.get("resource") || "",
      scope: p.get("scope") || "",
      mode: (p.get("mode") === "background" ? "background" : "user_present") as "user_present" | "background",
      embed: p.get("embed") === "1",
    };
  });

  async function init() {
    loading = true;
    error = null;
    try {
      const authState = get(auth);
      selectedIdentityId = authState.currentIdentity?.id || authState.identities[0]?.id || "";

      const appData = await api.oauth.getApp(params.clientId);
      appInfo = appData.app;
      resources = (appData.resources || []).filter((resource) => resource.status === "active");

      if (resources.length === 0) {
        error = "This app has no available connector resources.";
        return;
      }

      const preferredResource = resources.find((resource) => resource.resourceKey === params.resource) || resources[0];
      selectedResourceKey = preferredResource.resourceKey;
      selectedScope = params.scope ? params.scope : preferredResource.scopes[0];
      communicationMode = params.mode;
    } catch (e: any) {
      error = e?.message || "Failed to load connector details.";
    } finally {
      loading = false;
    }
  }

  async function handleConnect() {
    if (!selectedIdentityId || !selectedResourceKey || !selectedScope) return;
    connecting = true;
    error = null;

    try {
      const response = await api.oauth.authorize({
        clientId: params.clientId,
        redirectUri: params.redirectUri,
        scope: "openid profile email",
        state: params.state,
        identityId: selectedIdentityId,
        connector: true,
        requestedResource: selectedResourceKey,
        requestedScope: selectedScope,
        communicationMode,
      });

      if (params.embed) {
        const target = (window.opener && (window.opener as any).parent) ? (window.opener as any).parent : (window.opener ?? window.parent);
        target?.postMessage({ type: "ave:success", payload: { redirectUrl: response.redirectUrl } }, "*");
        if (window.opener) {
          setTimeout(() => window.close(), 50);
        }
        return;
      }
      window.location.href = response.redirectUrl;
    } catch (e: any) {
      error = e?.message || "Connector authorization failed.";
      connecting = false;
    }
  }

  function handleCancel() {
    if (params.embed) {
      const target = (window.opener && (window.opener as any).parent) ? (window.opener as any).parent : (window.opener ?? window.parent);
      target?.postMessage({ type: "ave:close" }, "*");
      if (window.opener) {
        setTimeout(() => window.close(), 50);
      }
      return;
    }
    history.back();
  }

  $effect(() => {
    if (!$isAuthenticated) {
      if (params.embed) {
        const target = (window.opener && (window.opener as any).parent) ? (window.opener as any).parent : (window.opener ?? window.parent);
        target?.postMessage({ type: "ave:auth_required" }, "*");
      }
      setReturnUrl(window.location.pathname + window.location.search);
      safeGoto(goto, "/login");
      return;
    }
    init();
  });
</script>

<div class="bg-[#090909] min-h-screen-fixed relative overflow-hidden px-4 md:px-[70px] py-6 md:py-[50px]">
  <AuroraBackdrop preset="dashboard-tr" cclass="absolute top-0 right-0 w-[70%] pointer-events-none select-none" />
  <AuroraBackdrop preset="dashboard-bl" cclass="absolute bottom-0 left-0 w-[80%] pointer-events-none select-none" />

  <div class="max-w-4xl mx-auto relative z-10 bg-[#111111]/60 rounded-[28px] md:rounded-[52px] p-6 md:p-[52px] backdrop-blur-[20px] border border-[#1E1E1E]">
    <Text type="h" size={44} mobileSize={30} weight="bold">Ave Connector</Text>
    <p class="text-[#8A8A8A] text-[14px] md:text-[18px] mt-2">
      Grant this app controlled access to another app resource through an explicit connector grant.
    </p>

    {#if loading}
      <div class="mt-10 text-[#8A8A8A]">Loading connector details...</div>
    {:else if error}
      <div class="mt-8 p-4 rounded-[14px] bg-[#2A1111] border border-[#502222] text-[#E57272]">{error}</div>
    {:else if appInfo}
      <div class="mt-8 grid gap-6 md:gap-8">
        <div class="p-4 md:p-6 rounded-[20px] bg-[#151515] border border-[#1f1f1f]">
          <p class="text-[#6D6D6D] text-[12px] uppercase tracking-[0.08em]">Requesting App</p>
          <p class="text-[22px] md:text-[28px] font-semibold mt-1 text-white">{appInfo.name}</p>
          {#if appInfo.description}<p class="text-[#8A8A8A] mt-2">{appInfo.description}</p>{/if}
        </div>

        <label class="block">
          <p class="text-[#B0B0B0] mb-2 text-[14px] md:text-[16px]">Target resource</p>
          <select class="w-full bg-[#151515] border border-[#2A2A2A] rounded-[14px] px-4 py-3 text-white" bind:value={selectedResourceKey}>
            {#each resources as resource}
              <option value={resource.resourceKey}>{resource.displayName} ({resource.resourceKey})</option>
            {/each}
          </select>
        </label>

        <label class="block">
          <p class="text-[#B0B0B0] mb-2 text-[14px] md:text-[16px]">Permission scope</p>
          <select class="w-full bg-[#151515] border border-[#2A2A2A] rounded-[14px] px-4 py-3 text-white" bind:value={selectedScope}>
            {#each (resources.find((r) => r.resourceKey === selectedResourceKey)?.scopes || []) as scope}
              <option value={scope}>{scope}</option>
            {/each}
          </select>
          <p class="text-[#7A7A7A] text-[13px] mt-2">
            Scopes are resource-defined by the target app and can be revoked anytime from your dashboard.
          </p>
        </label>

        <div class="p-4 md:p-6 rounded-[20px] bg-[#141414] border border-[#232323]">
          <p class="text-[#B0B0B0] mb-3 text-[14px] md:text-[16px]">Communication mode</p>
          <div class="flex flex-col md:flex-row gap-3">
            <button
              class="px-4 py-3 rounded-full border text-[14px] {communicationMode === 'user_present' ? 'border-white text-white bg-white/5' : 'border-[#333] text-[#9A9A9A]'}"
              onclick={() => communicationMode = "user_present"}
            >Only when user present</button>
            <button
              class="px-4 py-3 rounded-full border text-[14px] {communicationMode === 'background' ? 'border-white text-white bg-white/5' : 'border-[#333] text-[#9A9A9A]'}"
              onclick={() => communicationMode = "background"}
            >Allow background</button>
          </div>
        </div>

        <div class="p-4 md:p-6 rounded-[20px] bg-[#11161C] border border-[#27313C] text-[#9EB5CD] text-[14px]">
          If connector secrets are required, Ave may request passkey confirmation during connector runtime so protected material can be used securely in your browser session.
        </div>

        <div class="flex flex-col md:flex-row gap-3 mt-2">
          <button
            class="px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-[#EAEAEA] transition-colors disabled:opacity-60"
            disabled={connecting}
            onclick={handleConnect}
          >
            {connecting ? "Connecting..." : "Create Connector Grant"}
          </button>
          <button
            class="px-6 py-3 rounded-full border border-[#333] text-[#aaa] hover:text-white hover:border-[#555] transition-colors"
            onclick={handleCancel}
          >Cancel</button>
        </div>
      </div>
    {/if}
  </div>
</div>