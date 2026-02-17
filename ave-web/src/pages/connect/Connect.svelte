<script lang="ts">
  import { goto } from "@mateothegreat/svelte5-router";
  import { get } from "svelte/store";
  import { api } from "../../lib/api";
  import { auth, isAuthenticated } from "../../stores/auth";
  import { setReturnUrl } from "../../util/return-url";
  import { safeGoto } from "../../util/safe-goto";

  type AppInfo = {
    name: string;
    description?: string;
    iconUrl?: string;
    websiteUrl?: string;
  };

  type TargetResourceInfo = {
    resourceKey: string;
    displayName: string;
    description?: string;
    scopes: string[];
    audience: string;
    status: string;
    ownerAppClientId: string;
    ownerAppName: string;
    ownerAppDescription?: string;
    ownerAppIconUrl?: string;
    ownerAppWebsiteUrl?: string;
  };

  let loading = $state(true);
  let connecting = $state(false);
  let error = $state<string | null>(null);

  let appInfo = $state<AppInfo | null>(null);
  let targetResource = $state<TargetResourceInfo | null>(null);

  let selectedResourceKey = $state("");
  let selectedScope = $state("");
  let selectedIdentityId = $state("");
  let requestedCommunicationMode = $state<"user_present" | "background">("user_present");

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

  function pickScope(requestedScope: string, allowedScopes: string[]): string {
    if (!allowedScopes.length) return "";
    if (!requestedScope) return allowedScopes[0];

    const requested = requestedScope.split(" ").map((s) => s.trim()).filter(Boolean);
    const allAllowed = requested.every((scope) => allowedScopes.includes(scope));
    return allAllowed ? requested.join(" ") : "";
  }

  async function init() {
    loading = true;
    error = null;
    try {
      const authState = get(auth);
      selectedIdentityId = authState.currentIdentity?.id || authState.identities[0]?.id || "";

      if (!params.clientId || !params.redirectUri) {
        error = "Missing required connector parameters.";
        return;
      }

      if (!params.resource) {
        error = "Missing resource parameter.";
        return;
      }

      const [appData, resourceData] = await Promise.all([
        api.oauth.getApp(params.clientId),
        api.oauth.getResource(params.resource),
      ]);

      appInfo = appData.app;
      targetResource = resourceData.resource;
      selectedResourceKey = targetResource.resourceKey;
      requestedCommunicationMode = params.mode;

      const resolvedScope = pickScope(params.scope, targetResource.scopes || []);
      if (!resolvedScope) {
        error = params.scope
          ? "Requested access is not allowed for this connector resource."
          : "Target resource has no available access scope.";
        return;
      }

      selectedScope = resolvedScope;
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
        communicationMode: requestedCommunicationMode,
      });

      if (params.embed) {
        const target = (window.opener && (window.opener as any).parent)
          ? (window.opener as any).parent
          : (window.opener ?? window.parent);
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
      const target = (window.opener && (window.opener as any).parent)
        ? (window.opener as any).parent
        : (window.opener ?? window.parent);
      target?.postMessage({ type: "ave:close" }, "*");
      if (window.opener) {
        setTimeout(() => window.close(), 50);
      }
      return;
    }
    history.back();
  }

  function appInitial(name?: string) {
    return name?.[0]?.toUpperCase() || "?";
  }

  $effect(() => {
    if (!$isAuthenticated) {
      if (params.embed) {
        const target = (window.opener && (window.opener as any).parent)
          ? (window.opener as any).parent
          : (window.opener ?? window.parent);
        target?.postMessage({ type: "ave:auth_required" }, "*");
      }
      setReturnUrl(window.location.pathname + window.location.search);
      safeGoto(goto, "/login");
      return;
    }
    init();
  });
</script>

{#if loading}
  <div class="bg-[#090909] min-h-screen-fixed flex items-center justify-center p-6 md:p-[50px]">
    <div class="w-[48px] h-[48px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
  </div>
{:else if error}
  <div class="bg-[#090909] min-h-screen-fixed flex items-center justify-center p-6 md:p-[50px]">
    <div class="w-full max-w-[560px] rounded-[28px] bg-[#151515] p-6 md:p-10 text-center">
      <p class="text-[#E57272] text-[16px] md:text-[20px]">{error}</p>
      <button
        class="mt-6 px-6 py-3 rounded-full bg-[#FFFFFF] text-[#090909] font-semibold hover:bg-[#EAEAEA] transition-colors"
        onclick={handleCancel}
      >
        Go back
      </button>
    </div>
  </div>
{:else if appInfo && targetResource}
  <div class="bg-[#090909] min-h-screen-fixed flex flex-col md:flex-row md:items-stretch items-center gap-6 md:gap-[50px] p-6 md:p-[50px] relative overflow-auto">
    <div class="flex-1 z-10 flex flex-col items-start justify-start md:justify-between p-4 md:p-[50px] w-full">
      <div class="flex flex-row gap-4 md:gap-[20px] items-start">
        <button
          class="w-12 h-12 md:w-[80px] md:h-[80px] rounded-[12px] md:rounded-[16px] overflow-hidden bg-[#171717] flex items-center justify-center"
          onclick={handleCancel}
          title="Go back"
        >
          {#if appInfo.iconUrl}
            <img src={appInfo.iconUrl} alt="{appInfo.name} logo" class="w-full h-full object-cover" />
          {:else}
            <span class="text-[#878787] text-[18px] md:text-[30px] font-bold">{appInitial(appInfo.name)}</span>
          {/if}
        </button>

        <div class="flex flex-col gap-1 md:gap-[10px]">
          <h1 class="font-poppins text-2xl md:text-[48px] text-white leading-[1.05]">
            Connect {appInfo.name} to {targetResource.ownerAppName}
          </h1>
          <p class="font-poppins text-[14px] md:text-[22px] text-[#878787]">
            Approve to continue.
          </p>
        </div>
      </div>

      <div class="mt-8 md:mt-0 w-full max-w-[760px] bg-[#111111]/80 rounded-[20px] md:rounded-[32px] p-4 md:p-6">
        <div class="flex items-center justify-between gap-4 md:gap-8">
          <div class="flex flex-col items-center text-center min-w-[110px] md:min-w-[160px]">
            <div class="w-[56px] h-[56px] md:w-[88px] md:h-[88px] rounded-[16px] md:rounded-[24px] overflow-hidden bg-[#171717] flex items-center justify-center">
              {#if appInfo.iconUrl}
                <img src={appInfo.iconUrl} alt="{appInfo.name} icon" class="w-full h-full object-cover" />
              {:else}
                <span class="text-[#CFCFCF] text-[20px] md:text-[34px] font-bold">{appInitial(appInfo.name)}</span>
              {/if}
            </div>
            <p class="mt-2 text-white text-[16px] md:text-[24px] font-semibold">{appInfo.name}</p>
          </div>

          <svg class="text-[#BFC2C5] shrink-0" width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 12h16M13 5l7 7-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>

          <div class="flex flex-col items-center text-center min-w-[110px] md:min-w-[160px]">
            <div class="w-[56px] h-[56px] md:w-[88px] md:h-[88px] rounded-[16px] md:rounded-[24px] overflow-hidden bg-[#171717] flex items-center justify-center">
              {#if targetResource.ownerAppIconUrl}
                <img src={targetResource.ownerAppIconUrl} alt="{targetResource.ownerAppName} icon" class="h-full w-auto max-w-full object-contain" />
              {:else}
                <span class="text-[#CFCFCF] text-[20px] md:text-[34px] font-bold">{appInitial(targetResource.ownerAppName)}</span>
              {/if}
            </div>
            <p class="mt-2 text-white text-[16px] md:text-[24px] font-semibold">{targetResource.ownerAppName}</p>
          </div>
        </div>

        <div class="mt-5 space-y-2">
          <div class="bg-[#171717] rounded-[14px] px-4 py-3 flex items-center justify-between">
            <span class="text-[#8B8B8B] text-[13px] md:text-[15px]">Access</span>
            <span class="text-white text-[14px] md:text-[16px] font-semibold">{targetResource.displayName}</span>
          </div>
          <div class="bg-[#171717] rounded-[14px] px-4 py-3 flex items-center justify-between">
            <span class="text-[#8B8B8B] text-[13px] md:text-[15px]">Usage</span>
            <span class="text-white text-[14px] md:text-[16px] font-semibold">Inside {appInfo.name}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 w-full md:min-h-full px-4 md:px-[75px] z-10 py-5 md:py-[70px] flex flex-col justify-between rounded-[24px] md:rounded-[64px] bg-[#111111]/60 backdrop-blur-xl">
      <div class="flex flex-col gap-3 md:gap-[20px]">
        <h2 class="text-white text-2xl md:text-[52px] font-bold font-poppins leading-[1.02]">Approve access</h2>
        <p class="font-poppins text-[14px] md:text-[24px] text-[#878787] leading-[1.45]">
          This allows <span class="text-white font-semibold">{appInfo.name}</span> to use <span class="text-white font-semibold">{targetResource.ownerAppName}</span> for this feature.
        </p>
      </div>

      <div class="flex flex-col gap-3 md:gap-[20px] mt-8 md:mt-0">
        <button
          class="w-full py-3 md:py-[20px] bg-[#FFFFFF] text-[#090909] text-[18px] md:text-[40px] font-semibold rounded-full hover:bg-[#EAEAEA] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={connecting}
          onclick={handleConnect}
        >
          {connecting ? "Approving..." : "Approve and continue"}
        </button>

        <button
          class="w-full py-3 md:py-[20px] bg-[#171717] text-[#A8A8A8] text-[18px] md:text-[40px] font-semibold rounded-full hover:bg-[#222222] hover:text-[#E5E5E5] transition-colors"
          onclick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
