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

  <div class="max-w-[1350px] mx-auto relative z-10">
    {#if loading}
      <div class="panel-shell py-20 text-center text-[#8A8A8A]">Loading connector details...</div>
    {:else if error}
      <div class="panel-shell p-4 rounded-[14px] bg-[#2A1111] border border-[#502222] text-[#E57272]">{error}</div>
    {:else if appInfo && targetResource}
      <div class="panel-shell panel-grid">
        <section class="hero-pane">
          <p class="eyebrow">Ave Connector</p>
          <h1>
            <span>{appInfo.name}</span>
            <small>wants to use</small>
            <span>{targetResource.ownerAppName}</span>
          </h1>
          <p class="hero-copy">
            This is a separate connector grant on top of sign-in. The requesting app cannot change this request from this screen.
          </p>

          <div class="flow-card" aria-label="Connector direction">
            <div class="flow-app">
              <div class="app-icon-wrap">
                {#if appInfo.iconUrl}
                  <img src={appInfo.iconUrl} alt="{appInfo.name} icon" class="app-icon" />
                {:else}
                  <div class="app-fallback">{appInitial(appInfo.name)}</div>
                {/if}
              </div>
              <strong>{appInfo.name}</strong>
              <span>Requesting app</span>
            </div>

            <div class="flow-arrow" aria-hidden="true">
              <span></span>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 12h16M13 5l7 7-7 7" stroke="#C9CBCE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span></span>
            </div>

            <div class="flow-app">
              <div class="app-icon-wrap">
                {#if targetResource.ownerAppIconUrl}
                  <img src={targetResource.ownerAppIconUrl} alt="{targetResource.ownerAppName} icon" class="app-icon" />
                {:else}
                  <div class="app-fallback">{appInitial(targetResource.ownerAppName)}</div>
                {/if}
              </div>
              <strong>{targetResource.ownerAppName}</strong>
              <span>Target app</span>
            </div>
          </div>

          <div class="grant-card">
            <p class="eyebrow">Connector request</p>
            <div class="grant-item"><span class="grant-key">Resource</span><span class="grant-value">{targetResource.displayName} ({targetResource.resourceKey})</span></div>
            <div class="grant-item"><span class="grant-key">Scope</span><span class="grant-value">{selectedScope}</span></div>
            <div class="grant-item"><span class="grant-key">Mode</span><span class="grant-value">{requestedCommunicationMode === "background" ? "Background" : "User present"}</span></div>
            <div class="grant-item"><span class="grant-key">Revocation</span><span class="grant-value">Any time from dashboard</span></div>
          </div>
        </section>

        <section class="consent-pane">
          <h2>Approve connector grant</h2>
          <p>
            Approving lets <strong>{appInfo.name}</strong> call <strong>{targetResource.ownerAppName}</strong> on your behalf within the scope above.
          </p>

          <div class="note-card">
            If connector secrets are required, Ave may request passkey confirmation during connector runtime so protected material can be used securely in your browser session.
          </div>

          <div class="consent-lock">
            <span>Request is app-defined and locked on this screen.</span>
          </div>

          <div class="consent-actions">
            <button
              class="primary-btn"
              disabled={connecting}
              onclick={handleConnect}
            >
              {connecting ? "Creating connector grant..." : "Approve and continue"}
            </button>
            <button class="secondary-btn" onclick={handleCancel}>Cancel</button>
          </div>
        </section>
      </div>
    {/if}
  </div>
</div>

<style>
  .panel-shell {
    border-radius: 52px;
    border: 1px solid #1f1f1f;
    background: linear-gradient(180deg, rgba(16, 16, 16, 0.85), rgba(10, 10, 10, 0.9));
    backdrop-filter: blur(20px);
    padding: 28px;
  }

  .panel-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    gap: 22px;
  }

  .hero-pane,
  .consent-pane {
    border-radius: 36px;
    border: 1px solid #252525;
    background: rgba(12, 12, 12, 0.78);
    padding: 34px;
  }

  .eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #6f6f6f;
    font-size: 11px;
    font-weight: 600;
  }

  h1 {
    margin: 12px 0 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: #f5f5f5;
    font-size: clamp(34px, 4.7vw, 56px);
    line-height: 1.03;
    font-weight: 700;
  }

  h1 small {
    font-size: clamp(16px, 2vw, 21px);
    color: #8a8a8a;
    font-weight: 500;
    line-height: 1.2;
  }

  .hero-copy {
    margin: 16px 0 0;
    color: #8f8f8f;
    font-size: 16px;
    line-height: 1.52;
    max-width: 680px;
  }

  .flow-card,
  .grant-card {
    margin-top: 22px;
    border: 1px solid #262626;
    background: #101010;
    border-radius: 24px;
    padding: 18px;
  }

  .flow-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 16px;
  }

  .flow-app {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .flow-app strong {
    color: #f4f4f4;
    font-size: 22px;
    line-height: 1.1;
  }

  .flow-app span {
    color: #838383;
    font-size: 12px;
  }

  .app-icon-wrap {
    width: 86px;
    height: 86px;
    border-radius: 26px;
    border: 1px solid #2b2b2b;
    background: #151515;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .app-icon {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .app-fallback {
    font-size: 34px;
    font-weight: 700;
    color: #d4d4d4;
  }

  .flow-arrow {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 150px;
  }

  .flow-arrow span {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, #3a3a3a, transparent);
  }

  .grant-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .grant-item {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    border: 1px solid #252525;
    border-radius: 14px;
    padding: 10px 12px;
    background: #0f0f0f;
  }

  .grant-key {
    color: #8d8d8d;
    font-size: 13px;
  }

  .grant-value {
    color: #f1f1f1;
    font-size: 15px;
    font-weight: 600;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .consent-pane {
    display: flex;
    flex-direction: column;
  }

  .consent-pane h2 {
    margin: 0;
    font-size: 42px;
    color: #f6f6f6;
    line-height: 1.04;
  }

  .consent-pane p {
    margin: 14px 0 0;
    color: #8f8f8f;
    line-height: 1.52;
    font-size: 16px;
  }

  .consent-pane p strong {
    color: #dfdfdf;
  }

  .note-card {
    margin-top: 20px;
    border-radius: 18px;
    border: 1px solid #274067;
    background: #111822;
    color: #9eb5cd;
    font-size: 14px;
    line-height: 1.5;
    padding: 16px;
  }

  .consent-lock {
    margin-top: 14px;
    border-radius: 14px;
    border: 1px solid #2f2f2f;
    background: #141414;
    color: #9d9d9d;
    font-size: 13px;
    padding: 12px;
  }

  .consent-actions {
    margin-top: auto;
    padding-top: 22px;
    display: grid;
    gap: 10px;
  }

  .primary-btn,
  .secondary-btn {
    width: 100%;
    border-radius: 999px;
    padding: 14px 18px;
    font-size: 23px;
    line-height: 1;
    font-weight: 600;
    transition: all 0.15s ease;
  }

  .primary-btn {
    border: 1px solid transparent;
    background: #f2f2f2;
    color: #090909;
  }

  .primary-btn:hover:not(:disabled) {
    background: #ffffff;
  }

  .primary-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .secondary-btn {
    border: 1px solid #3b3b3b;
    background: transparent;
    color: #a9a9a9;
  }

  .secondary-btn:hover {
    color: #e4e4e4;
    border-color: #636363;
  }

  @media (max-width: 1080px) {
    .panel-shell {
      border-radius: 32px;
      padding: 16px;
    }

    .panel-grid {
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .hero-pane,
    .consent-pane {
      border-radius: 24px;
      padding: 20px;
    }

    h1 {
      font-size: clamp(30px, 11vw, 48px);
    }

    .consent-pane h2 {
      font-size: clamp(28px, 9vw, 44px);
    }

    .flow-card {
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .flow-arrow {
      min-width: 0;
      width: 100%;
    }

    .grant-item {
      grid-template-columns: 1fr;
      gap: 4px;
    }

    .grant-value {
      text-align: left;
    }
  }
</style>
