<script lang="ts">
  import { page } from "$app/state";
  import { setQueryClientContext } from "@tanstack/svelte-query";
  import { onMount } from "svelte";
  import { queryClient } from "$lib/surfaces/web/lib/query-client";
  import { auth, isLoading } from "$lib/surfaces/web/stores/auth";

  let { children } = $props();

  const staticRoutes = ["/web", "/web/privacy", "/web/terms", "/web/docs"];
  const isStaticRoute = $derived.by(() => {
    const path = page.url.pathname;
    return staticRoutes.some((route) => path === route || path.startsWith(`${route}/`));
  });

  setQueryClientContext(queryClient);

  function warmLikelyRoutes() {
    void import("./login/+page.svelte");
    void import("./register/+page.svelte");
    void import("./authorize/AuthorizeFlow.svelte");
    void import("./dashboard/+page.svelte");
    void import("./sign/+page.svelte");
  }

  function scheduleRouteWarmup() {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
    };

    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(warmLikelyRoutes, { timeout: 2000 });
      return;
    }

    window.setTimeout(warmLikelyRoutes, 1200);
  }

  onMount(() => {
    void auth.init();
    scheduleRouteWarmup();
  });
</script>

{#if $isLoading && !isStaticRoute}
  <div class="grid h-screen-fixed w-full place-items-center bg-[#090909]">
    <div class="h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-white"></div>
  </div>
{:else}
  {@render children()}
{/if}
