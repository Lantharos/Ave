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

  let sliderPosition = $state(0);
  let sliderActive = $state(false);
  let sliderPointerId: number | null = null;
  let sliderRef: HTMLElement | null = null;
  let sliderMaxTravel = $state(0);

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
      sliderPosition = 0;
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

  function getButtonWidth() {
    return typeof window !== "undefined" && window.innerWidth < 768 ? 44 : 70;
  }

  function cleanupSlider() {
    sliderActive = false;

    if (sliderRef && sliderPointerId !== null) {
      try {
        sliderRef.releasePointerCapture(sliderPointerId);
      } catch {}
    }

    sliderPointerId = null;
    sliderRef = null;
    document.removeEventListener("pointermove", handleSliderMove);
    document.removeEventListener("pointerup", handleSliderEnd);
    document.removeEventListener("pointercancel", handleSliderEnd);
  }

  function handleSliderStart(e: PointerEvent) {
    if (connecting) return;
    e.preventDefault();

    sliderActive = true;
    sliderPointerId = e.pointerId;
    sliderRef = document.getElementById("connect-slider");
    if (sliderRef) {
      const rect = sliderRef.getBoundingClientRect();
      sliderMaxTravel = rect.width - getButtonWidth();
      try {
        sliderRef.setPointerCapture(e.pointerId);
      } catch {
        document.addEventListener("pointermove", handleSliderMove);
        document.addEventListener("pointerup", handleSliderEnd);
        document.addEventListener("pointercancel", handleSliderEnd);
      }
    }
  }

  function handleSliderMove(e: PointerEvent) {
    if (!sliderActive) return;
    if (sliderPointerId !== null && e.pointerId !== sliderPointerId) return;

    e.preventDefault();
    if (!sliderRef || sliderMaxTravel <= 0) return;

    const rect = sliderRef.getBoundingClientRect();
    const buttonWidth = getButtonWidth();
    const relativeX = e.clientX - rect.left - buttonWidth / 2;
    const position = Math.max(0, Math.min(1, relativeX / sliderMaxTravel));
    sliderPosition = position;

    if (position >= 0.95) {
      cleanupSlider();
      handleConnect();
    }
  }

  function handleSliderEnd(e: PointerEvent) {
    if (!sliderActive) return;
    if (sliderPointerId !== null && e.pointerId !== sliderPointerId) return;

    cleanupSlider();
    if (sliderPosition < 0.95) {
      sliderPosition = 0;
    }
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

<div class="bg-[#090909] min-h-screen-fixed relative overflow-hidden flex items-center justify-center p-6 md:p-[50px]">
  <div class="absolute bottom-0 right-0 pointer-events-none hidden md:block">
    <svg width="1416" height="695" viewBox="0 0 1416 695" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter="url(#filter0_f_3071_668)">
        <path d="M910.219 401.152C913.621 399.616 917.519 399.616 920.921 401.152L1423.47 628.138C1436.23 633.9 1432.12 652.985 1418.12 652.985H413.018C399.02 652.985 394.91 633.9 407.667 628.138L910.219 401.152Z" fill="#B9BBBE"/>
      </g>
      <defs>
        <filter id="filter0_f_3071_668" x="0" y="0" width="1831.14" height="1052.99" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix"/>
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur stdDeviation="200" result="effect1_foregroundBlur_3071_668"/>
        </filter>
      </defs>
    </svg>
  </div>

  {#if loading}
    <div class="w-[48px] h-[48px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin z-10"></div>
  {:else if error}
    <div class="w-full max-w-[560px] rounded-[28px] bg-[#151515] p-6 md:p-10 text-center z-10">
      <p class="text-[#E57272] text-[16px] md:text-[20px]">{error}</p>
      <button
        class="mt-6 px-6 py-3 rounded-full bg-[#FFFFFF] text-[#090909] font-semibold hover:bg-[#EAEAEA] transition-colors"
        onclick={handleCancel}
      >
        Go back
      </button>
    </div>
  {:else if appInfo && targetResource}
    <div class="w-full max-w-[940px] z-10 px-4 md:px-[75px] py-5 md:py-[60px] flex flex-col gap-8 rounded-[24px] md:rounded-[64px] bg-[#111111]/60 backdrop-blur-xl">
      <div class="flex flex-col gap-2">
        <h1 class="text-white text-[34px] md:text-[48px] font-bold font-poppins leading-[1.03]">Approve access</h1>
        <p class="font-poppins text-[14px] md:text-[20px] text-[#878787] leading-[1.45]">
          This allows <span class="text-white font-semibold">{appInfo.name}</span> to use <span class="text-white font-semibold">{targetResource.ownerAppName}</span> for this feature.
        </p>
      </div>

      <div class="bg-[#111111] rounded-[20px] md:rounded-[32px] p-4 md:p-6 space-y-4">
        <div class="flex items-center justify-between gap-4 md:gap-8">
          <div class="flex flex-col items-center text-center min-w-[110px] md:min-w-[160px]">
            <div class="w-[56px] h-[56px] md:w-[88px] md:h-[88px] rounded-[16px] md:rounded-[24px] overflow-hidden bg-[#171717] flex items-center justify-center">
              {#if appInfo.iconUrl}
                <img src={appInfo.iconUrl} alt="{appInfo.name} icon" class="w-full h-full object-cover" />
              {:else}
                <span class="text-[#CFCFCF] text-[20px] md:text-[34px] font-bold">{appInitial(appInfo.name)}</span>
              {/if}
            </div>
            <p class="mt-2 text-white text-[16px] md:text-[22px] font-semibold">{appInfo.name}</p>
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
            <p class="mt-2 text-white text-[16px] md:text-[22px] font-semibold">{targetResource.ownerAppName}</p>
          </div>
        </div>

        <div class="space-y-2">
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

      <div class="flex flex-col gap-3 md:gap-[14px]">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          id="connect-slider"
          class="rounded-full bg-[#171717]/80 border-[3px] md:border-[6px] border-[#171717]/80 w-full relative h-[50px] md:h-[82px] touch-none select-none"
          onpointerdown={handleSliderStart}
          onpointermove={handleSliderMove}
          onpointerup={handleSliderEnd}
          onpointercancel={handleSliderEnd}
        >
          <div
            class="w-[44px] h-[44px] md:w-[70px] md:h-[70px] bg-white rounded-full flex items-center justify-center absolute top-0 left-0 z-10 pointer-events-none {sliderActive ? '' : 'transition-[transform] duration-300'}"
            style="transform: translateX({sliderMaxTravel > 0 ? sliderPosition * sliderMaxTravel : sliderPosition * 100}px);"
          >
            {#if connecting}
              <div class="w-5 h-5 md:w-[24px] md:h-[24px] border-2 border-[#090909] border-t-transparent rounded-full animate-spin"></div>
            {:else}
              <svg class="w-5 h-5 md:w-[35px] md:h-[35px]" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 30L23 18L11 6" stroke="#090909" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {/if}
          </div>

          <p class="text-[#878787] text-sm md:text-[18px] font-poppins font-normal absolute top-0 bottom-0 left-0 right-0 text-center flex items-center justify-center pointer-events-none">
            {connecting ? "Approving..." : "Swipe to Approve"}
          </p>
        </div>

        <button
          class="w-full py-3 bg-[#171717] text-[#A8A8A8] text-[20px] md:text-[22px] font-semibold rounded-full hover:bg-[#222222] hover:text-[#E5E5E5] transition-colors"
          onclick={handleCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}
</div>
