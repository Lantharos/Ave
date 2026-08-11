<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { setQueryClientContext } from "@tanstack/svelte-query";
  import { queryClient } from "$lib/surfaces/web/lib/query-client";
  import { auth, isLoading } from "$lib/surfaces/web/stores/auth";

  let { children } = $props();

  const staticRoutes = new Set(["/", "/privacy", "/terms", "/docs"]);

  function publicPathname(pathname: string) {
    const path = pathname === "/web"
      ? "/"
      : pathname.startsWith("/web/")
        ? pathname.slice(4)
        : pathname;

    return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  }

  function isStaticPath(pathname: string) {
    return staticRoutes.has(publicPathname(pathname));
  }

  const isStaticRoute = $derived(isStaticPath(page.url.pathname));

  setQueryClientContext(queryClient);

  afterNavigate(() => {
    if (!isStaticPath(page.url.pathname)) {
      void auth.init();
    }
  });
</script>

{#if $isLoading && !isStaticRoute}
  <div class="grid h-screen-fixed w-full place-items-center bg-[#090909]">
    <div class="h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-white"></div>
  </div>
{:else}
  {@render children()}
{/if}
