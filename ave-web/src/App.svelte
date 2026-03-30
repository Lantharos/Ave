<script lang="ts">
    import {
        Router,
        StatusCode,
        type Statuses,
    } from "@mateothegreat/svelte5-router";
    import { setQueryClientContext } from "@tanstack/svelte-query";
    import { onMount } from "svelte";
    import NotFound from "./pages/status/NotFound.svelte";
    import { queryClient } from "./lib/query-client";
    import { auth, isLoading } from "./stores/auth";

    const routes = [
        { path: "/", component: async () => (await import("./pages/home/Home.svelte")).default },
        { path: "/login", component: async () => (await import("./pages/login/Login.svelte")).default },
        { path: "/register", component: async () => (await import("./pages/register/Register.svelte")).default },
        { path: "/dashboard", component: async () => (await import("./pages/dashboard/Dashboard.svelte")).default },
        { path: "/dashboard/(.*)", component: async () => (await import("./pages/dashboard/Dashboard.svelte")).default },
        { path: "/shared/claim", component: async () => (await import("./pages/shared/Claim.svelte")).default },
        { path: "/privacy", component: async () => (await import("./pages/home/legal/PrivacyPolicy.svelte")).default },
        { path: "/terms", component: async () => (await import("./pages/home/legal/TermsOfService.svelte")).default },
        { path: "/authorize", component: async () => (await import("./pages/authorize/Authorize.svelte")).default },
        { path: "/signin", component: async () => (await import("./pages/authorize/Authorize.svelte")).default },
        { path: "/connect", component: async () => (await import("./pages/connect/Connect.svelte")).default },
        { path: "/connect/runtime", component: async () => (await import("./pages/connect/Runtime.svelte")).default },
        { path: "/docs(#.*)?", component: async () => (await import("./pages/docs/DocsRedirect.svelte")).default },
        { path: "/sign", component: async () => (await import("./pages/sign/Sign.svelte")).default },
    ];

    const statuses: Statuses = {
        [StatusCode.NotFound]: () => ({ component: NotFound }),
    };

    setQueryClientContext(queryClient);

    onMount(async () => {
        await auth.init();
    });

    const staticRoutes = [
        "/",
        "/privacy",
        "/terms",
        "/docs",
    ];

    const isStaticRoute = $derived.by(() => {
        if (typeof window === "undefined") return false;
        const path = window.location.pathname;
        return staticRoutes.some((route) => path === route || path.startsWith(`${route}/`));
    });
</script>

{#if $isLoading && !isStaticRoute}
    <div class="bg-[#090909] w-full h-screen-fixed grid place-items-center">
        <div
            class="w-12 h-12 border-4 border-transparent border-t-white rounded-full animate-spin"
        ></div>
    </div>
{:else}
    <Router {routes} {statuses} />
{/if}
