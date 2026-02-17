<script lang="ts">
  import { goto } from "@mateothegreat/svelte5-router";
  import { get } from "svelte/store";
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

<div class="bg-[#090909] min-h-screen-fixed relative overflow-hidden px-4 md:px-[70px] py-6 md:py-[50px]">
  <AuroraBackdrop preset="dashboard-tr" cclass="absolute top-0 right-0 w-[70%] pointer-events-none select-none" />
  <AuroraBackdrop preset="dashboard-bl" cclass="absolute bottom-0 left-0 w-[80%] pointer-events-none select-none" />

  <div class="max-w-[1240px] mx-auto relative z-10">
    {#if loading}
      <div class="shell"><p class="state-copy">Loading connector details...</p></div>
    {:else if error}
      <div class="shell shell-error"><p>{error}</p></div>
    {:else if appInfo && targetResource}
      <div class="shell shell-grid">
        <section class="hero">
          <p class="hero-eyebrow">Ave Connector</p>
          <h1>{appInfo.name} wants to connect with {targetResource.ownerAppName}</h1>
          <p class="hero-sub">Review access and approve.</p>

          <div class="flow">
            <div class="flow-app">
              <div class="icon-wrap">
                {#if appInfo.iconUrl}
                  <img src={appInfo.iconUrl} alt="{appInfo.name} icon" class="icon icon-fill" />
                {:else}
                  <div class="icon-fallback">{appInitial(appInfo.name)}</div>
                {/if}
              </div>
              <strong>{appInfo.name}</strong>
              <span>Requesting app</span>
            </div>

            <div class="flow-arrow" aria-hidden="true">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 12h16M13 5l7 7-7 7" stroke="#BFC2C5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>

            <div class="flow-app">
              <div class="icon-wrap">
                {#if targetResource.ownerAppIconUrl}
                  <img src={targetResource.ownerAppIconUrl} alt="{targetResource.ownerAppName} icon" class="icon icon-target" />
                {:else}
                  <div class="icon-fallback">{appInitial(targetResource.ownerAppName)}</div>
                {/if}
              </div>
              <strong>{targetResource.ownerAppName}</strong>
              <span>Target app</span>
            </div>
          </div>

          <div class="meta">
            <div><span class="meta-key">Resource</span><span>{targetResource.displayName}</span></div>
            <div><span class="meta-key">Scope</span><span>{selectedScope}</span></div>
          </div>
        </section>

        <section class="consent">
          <h2>Approve access</h2>
          <p>
            This will let <strong>{appInfo.name}</strong> use <strong>{targetResource.ownerAppName}</strong> for this feature.
          </p>

          <div class="actions">
            <button class="btn-primary" disabled={connecting} onclick={handleConnect}>
              {connecting ? "Approving..." : "Approve and continue"}
            </button>
            <button class="btn-secondary" onclick={handleCancel}>Cancel</button>
          </div>
        </section>
      </div>
    {/if}
  </div>
</div>

<style>
  .shell {
    border-radius: 52px;
    background: #11111199;
    backdrop-filter: blur(20px);
    padding: 24px;
    min-height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shell-error {
    background: #2a1111;
    color: #e57272;
    justify-content: flex-start;
    min-height: 0;
  }

  .state-copy {
    margin: 0;
    color: #8a8a8a;
    font-size: 18px;
  }

  .shell-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
    gap: 20px;
    align-items: stretch;
    justify-content: initial;
  }

  .hero,
  .consent {
    border-radius: 36px;
    background: #101010;
    padding: 34px;
  }

  .hero-eyebrow {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #7a7a7a;
  }

  .hero h1 {
    margin: 10px 0 0;
    color: #f4f4f4;
    font-size: clamp(34px, 4.8vw, 56px);
    line-height: 1.03;
    font-weight: 700;
    max-width: 15ch;
  }

  .hero-sub {
    margin: 14px 0 0;
    color: #8e8e8e;
    font-size: 18px;
  }

  .flow {
    margin-top: 24px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 14px;
    align-items: center;
  }

  .flow-app {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .icon-wrap {
    width: 88px;
    height: 88px;
    border-radius: 24px;
    background: #171717;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 0;
  }

  .icon {
    display: block;
  }

  .icon-fill {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .icon-target {
    height: 100%;
    width: auto;
    max-width: 100%;
    object-fit: contain;
  }

  .icon-fallback {
    color: #d0d0d0;
    font-size: 34px;
    font-weight: 700;
  }

  .flow-app strong {
    margin-top: 10px;
    color: #f5f5f5;
    font-size: 22px;
    line-height: 1.1;
  }

  .flow-app span {
    color: #888;
    font-size: 12px;
    margin-top: 3px;
  }

  .flow-arrow {
    color: #bfc2c5;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .meta {
    margin-top: 24px;
    display: grid;
    gap: 10px;
  }

  .meta div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    background: #161616;
    border-radius: 14px;
    padding: 12px 14px;
  }

  .meta-key {
    color: #8b8b8b;
    font-size: 13px;
  }

  .meta span {
    color: #f2f2f2;
    font-size: 15px;
    font-weight: 600;
  }

  .consent {
    display: flex;
    flex-direction: column;
  }

  .consent h2 {
    margin: 0;
    color: #f3f3f3;
    font-size: clamp(32px, 4vw, 46px);
    line-height: 1.05;
  }

  .consent p {
    margin: 14px 0 0;
    color: #8e8e8e;
    font-size: 18px;
    line-height: 1.5;
  }

  .consent strong {
    color: #f0f0f0;
  }

  .actions {
    margin-top: auto;
    padding-top: 28px;
    display: grid;
    gap: 10px;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
    border-radius: 999px;
    padding: 14px 18px;
    font-size: 22px;
    font-weight: 600;
    line-height: 1;
  }

  .btn-primary {
    border: 0;
    background: #f2f2f2;
    color: #090909;
  }

  .btn-primary:hover:not(:disabled) {
    background: #fff;
  }

  .btn-primary:disabled {
    opacity: 0.65;
  }

  .btn-secondary {
    border: 0;
    background: #181818;
    color: #b0b0b0;
  }

  .btn-secondary:hover {
    color: #e2e2e2;
    background: #232323;
  }

  @media (max-width: 1080px) {
    .shell {
      border-radius: 28px;
      padding: 14px;
    }

    .shell-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .hero,
    .consent {
      border-radius: 22px;
      padding: 20px;
    }

    .hero h1 {
      font-size: clamp(30px, 10vw, 46px);
      max-width: none;
    }

    .consent h2 {
      font-size: clamp(28px, 9vw, 40px);
    }

    .flow {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .meta div {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }
</style>
