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

    const loadHome = async () => (await import("./pages/home/Home.svelte")).default;
    const loadLogin = async () => (await import("./pages/login/Login.svelte")).default;
    const loadRegister = async () => (await import("./pages/register/Register.svelte")).default;
    const loadDashboard = async () => (await import("./pages/dashboard/Dashboard.svelte")).default;
    const loadPrivacy = async () => (await import("./pages/home/legal/PrivacyPolicy.svelte")).default;
    const loadTerms = async () => (await import("./pages/home/legal/TermsOfService.svelte")).default;
    const loadAuthorize = async () => (await import("./pages/authorize/Authorize.svelte")).default;
    const loadConnect = async () => (await import("./pages/connect/Connect.svelte")).default;
    const loadRuntime = async () => (await import("./pages/connect/Runtime.svelte")).default;
    const loadDocs = async () => (await import("./pages/docs/DocsRedirect.svelte")).default;
    const loadSign = async () => (await import("./pages/sign/Sign.svelte")).default;

    const routes = [
        { path: "/", component: loadHome },
        { path: "/login", component: loadLogin },
        { path: "/register", component: loadRegister },
        { path: "/dashboard", component: loadDashboard },
        { path: "/dashboard/(.*)", component: loadDashboard },
        { path: "/privacy", component: loadPrivacy },
        { path: "/terms", component: loadTerms },
        { path: "/authorize", component: loadAuthorize },
        { path: "/signin", component: loadAuthorize },
        { path: "/connect", component: loadConnect },
        { path: "/connect/runtime", component: loadRuntime },
        { path: "/docs(#.*)?", component: loadDocs },
        { path: "/sign", component: loadSign },
    ];

    const statuses: Statuses = {
        [StatusCode.NotFound]: () => ({ component: NotFound }),
    };

    setQueryClientContext(queryClient);

    function warmLikelyRoutes() {
        const warm = [loadLogin, loadRegister, loadAuthorize, loadDashboard, loadSign];
        for (const load of warm) {
            void load();
        }
    }

    function scheduleRouteWarmup() {
        if (typeof window === "undefined") return;
        const idleWindow = window as Window & {
            requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
        };

        if (idleWindow.requestIdleCallback) {
            idleWindow.requestIdleCallback(warmLikelyRoutes, { timeout: 2000 });
            return;
        }

        window.setTimeout(warmLikelyRoutes, 1200);
    }

    onMount(async () => {
        const init = auth.init();
        scheduleRouteWarmup();
        await init;
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
