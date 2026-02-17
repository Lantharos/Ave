<script lang="ts">
  import { goto } from "@mateothegreat/svelte5-router";
  import { get } from "svelte/store";
  import Text from "../../components/Text.svelte";
  import AuroraBackdrop from "../../components/AuroraBackdrop.svelte";
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
        error = "Missing resource parameter. This connector link must target a specific resource.";
        return;
      }

      const [appData, resourceData] = await Promise.all([
        api.oauth.getApp(params.clientId),
        api.oauth.getResource(params.resource),
      ]);

      appInfo = appData.app;
      targetResource = resourceData.resource;
      selectedResourceKey = targetResource.resourceKey;
      communicationMode = params.mode;

      const resolvedScope = pickScope(params.scope, targetResource.scopes || []);
      if (!resolvedScope) {
        error = params.scope
          ? "Requested scope is not allowed for this connector resource."
          : "Target resource has no available scopes.";
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

  function appInitial(name?: string) {
    return name?.[0]?.toUpperCase() || "?";
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

  <div class="max-w-[1200px] mx-auto relative z-10 bg-[#111111]/60 rounded-[28px] md:rounded-[52px] p-6 md:p-[40px] backdrop-blur-[20px] border border-[#1E1E1E]">
    {#if loading}
      <div class="py-14 text-center text-[#8A8A8A]">Loading connector details...</div>
    {:else if error}
      <div class="p-4 rounded-[14px] bg-[#2A1111] border border-[#502222] text-[#E57272]">{error}</div>
    {:else if appInfo && targetResource}
      <div class="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 md:gap-8">
        <section class="rounded-[24px] border border-[#222] bg-[#101010] p-5 md:p-8">
          <Text type="h" size={42} mobileSize={28} weight="bold">Connect apps with Ave</Text>
          <p class="text-[#8A8A8A] text-[14px] md:text-[17px] mt-2">
            Connector grants are separate from sign-in and let one app call another app's resource with your explicit approval.
          </p>

          <div class="mt-8 rounded-[22px] border border-[#232323] bg-[#0d0d0d] p-4 md:p-6">
            <div class="flex items-center justify-between gap-4 md:gap-8">
              <div class="app-node">
                <div class="app-icon-wrap">
                  {#if appInfo.iconUrl}
                    <img src={appInfo.iconUrl} alt="{appInfo.name} icon" class="app-icon" />
                  {:else}
                    <div class="app-fallback">{appInitial(appInfo.name)}</div>
                  {/if}
                </div>
                <p class="app-label">{appInfo.name}</p>
                <p class="app-sub">Requesting app</p>
              </div>

              <div class="connector-link" aria-hidden="true">
                <span></span>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 12h12M12 6l6 6-6 6" stroke="#B9BBBE" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span></span>
              </div>

              <div class="app-node">
                <div class="app-icon-wrap">
                  {#if targetResource.ownerAppIconUrl}
                    <img src={targetResource.ownerAppIconUrl} alt="{targetResource.ownerAppName} icon" class="app-icon" />
                  {:else}
                    <div class="app-fallback">{appInitial(targetResource.ownerAppName)}</div>
                  {/if}
                </div>
                <p class="app-label">{targetResource.ownerAppName}</p>
                <p class="app-sub">Target app</p>
              </div>
            </div>
          </div>

          <div class="mt-6 rounded-[20px] border border-[#232323] bg-[#131313] p-4 md:p-6">
            <p class="text-[#6F6F6F] uppercase tracking-[0.09em] text-[11px] mb-2">Grant details</p>
            <div class="grid gap-3">
              <div class="grant-row">
                <span>Resource</span>
                <strong>{targetResource.displayName} <em>({targetResource.resourceKey})</em></strong>
              </div>
              <div class="grant-row">
                <span>Scope</span>
                <strong>{selectedScope}</strong>
              </div>
              <div class="grant-row">
                <span>Persistence</span>
                <strong>Persistent until revoked</strong>
              </div>
            </div>
            <p class="text-[#7C7C7C] text-[13px] mt-4">
              Scope and resource are set by the requesting app and validated against the target resource definition.
            </p>
          </div>
        </section>

        <section class="rounded-[24px] border border-[#232323] bg-[#0f0f0f] p-5 md:p-8 flex flex-col">
          <h2 class="text-white text-[24px] md:text-[30px] font-semibold">Connector consent</h2>
          <p class="text-[#8A8A8A] text-[14px] mt-2">
            Choose how communication is allowed, then create this connector grant.
          </p>

          <div class="mt-6 rounded-[18px] border border-[#27313C] bg-[#11161C] p-4 text-[#9EB5CD] text-[13px] leading-[1.45]">
            If connector secrets are required, Ave may request passkey confirmation during connector runtime so protected material can be used securely in your browser session.
          </div>

          <div class="mt-6 rounded-[18px] border border-[#232323] bg-[#121212] p-4">
            <p class="text-[13px] text-[#A6A6A6] mb-3">Communication mode</p>
            <div class="grid grid-cols-1 gap-2">
              <button
                class="mode-btn {communicationMode === 'user_present' ? 'active' : ''}"
                onclick={() => communicationMode = 'user_present'}
              >
                <span>Only when user present</span>
                <small>Use this connector while you are actively in the requesting app.</small>
              </button>
              <button
                class="mode-btn {communicationMode === 'background' ? 'active' : ''}"
                onclick={() => communicationMode = 'background'}
              >
                <span>Allow background</span>
                <small>Allow server-to-server use after consent, until revoked.</small>
              </button>
            </div>
          </div>

          <div class="mt-auto pt-6 flex flex-col gap-2">
            <button
              class="w-full px-6 py-3 rounded-full bg-white text-black font-semibold hover:bg-[#EAEAEA] transition-colors disabled:opacity-60"
              disabled={connecting}
              onclick={handleConnect}
            >
              {connecting ? 'Creating grant...' : 'Create connector grant'}
            </button>
            <button
              class="w-full px-6 py-3 rounded-full border border-[#333] text-[#aaa] hover:text-white hover:border-[#555] transition-colors"
              onclick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </section>
      </div>
    {/if}
  </div>
</div>

<style>
  .app-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    min-width: 140px;
  }

  .app-icon-wrap {
    width: 78px;
    height: 78px;
    border-radius: 22px;
    border: 1px solid #2a2a2a;
    background: #111;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-shadow: inset 0 0 0 1px #171717;
  }

  .app-icon {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .app-fallback {
    font-size: 30px;
    font-weight: 700;
    color: #d2d2d2;
  }

  .app-label {
    margin-top: 10px;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
  }

  .app-sub {
    margin-top: 2px;
    color: #7f7f7f;
    font-size: 12px;
  }

  .connector-link {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    max-width: 240px;
  }

  .connector-link span {
    height: 1px;
    flex: 1;
    background: linear-gradient(90deg, transparent, #3a3a3a, transparent);
  }

  .grant-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    border: 1px solid #242424;
    border-radius: 12px;
    padding: 10px 12px;
    background: #111;
    align-items: center;
  }

  .grant-row span {
    color: #999;
    font-size: 13px;
  }

  .grant-row strong {
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    text-align: right;
  }

  .grant-row em {
    color: #8a8a8a;
    font-style: normal;
    font-weight: 500;
  }

  .mode-btn {
    text-align: left;
    border: 1px solid #333;
    background: #111;
    color: #b3b3b3;
    border-radius: 14px;
    padding: 12px;
    transition: all 120ms ease;
  }

  .mode-btn span {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #d9d9d9;
  }

  .mode-btn small {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    color: #8b8b8b;
    line-height: 1.4;
  }

  .mode-btn.active {
    border-color: #6f6f6f;
    background: #181818;
    box-shadow: inset 0 0 0 1px #3b3b3b;
  }

  @media (max-width: 800px) {
    .connector-link {
      max-width: 90px;
      gap: 4px;
    }

    .app-icon-wrap {
      width: 62px;
      height: 62px;
      border-radius: 18px;
    }

    .app-node {
      min-width: 92px;
    }
  }
</style>
