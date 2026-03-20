<script lang="ts">
    import {
        Router,
        StatusCode,
        type Statuses,
    } from "@mateothegreat/svelte5-router";
    import { onMount } from "svelte";
    import NotFound from "./pages/status/NotFound.svelte";
    import { auth, isLoading } from "./stores/auth";

    const routes = [
        { path: "/", component: () => import("./pages/home/Home.svelte") },
        { path: "/login", component: () => import("./pages/login/Login.svelte") },
        { path: "/register", component: () => import("./pages/register/Register.svelte") },
        { path: "/dashboard", component: () => import("./pages/dashboard/Dashboard.svelte") },
        { path: "/dashboard/(.*)", component: () => import("./pages/dashboard/Dashboard.svelte") },
        { path: "/privacy", component: () => import("./pages/home/legal/PrivacyPolicy.svelte") },
        { path: "/terms", component: () => import("./pages/home/legal/TermsOfService.svelte") },
        { path: "/authorize", component: () => import("./pages/authorize/Authorize.svelte") },
        { path: "/signin", component: () => import("./pages/authorize/Authorize.svelte") },
        { path: "/connect", component: () => import("./pages/connect/Connect.svelte") },
        { path: "/connect/runtime", component: () => import("./pages/connect/Runtime.svelte") },
        { path: "/docs(#.*)?", component: () => import("./pages/docs/DocsRedirect.svelte") },
        { path: "/sign", component: () => import("./pages/sign/Sign.svelte") },
    ];

    const statuses: Statuses = {
        [StatusCode.NotFound]: () => ({ component: NotFound }),
    };

    onMount(async () => {
        await auth.init();
    });
</script>

{#if $isLoading}
    <div class="bg-[#090909] w-full h-screen-fixed grid place-items-center">
        <div
            class="w-12 h-12 border-4 border-transparent border-t-white rounded-full animate-spin"
        ></div>
    </div>
{:else}
    <Router {routes} {statuses} />
{/if}
