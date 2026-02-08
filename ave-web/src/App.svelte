<script lang="ts">
    import {
        Router,
        StatusCode,
        type Statuses,
    } from "@mateothegreat/svelte5-router";
    import { onMount } from "svelte";
    import Home from "./pages/home/Home.svelte";
    import NotFound from "./pages/status/NotFound.svelte";
    import Login from "./pages/login/Login.svelte";
    import Register from "./pages/register/Register.svelte";
    import Dashboard from "./pages/dashboard/Dashboard.svelte";
    import PrivacyPolicy from "./pages/home/legal/PrivacyPolicy.svelte";
    import TermsOfService from "./pages/home/legal/TermsOfService.svelte";
    import Authorize from "./pages/authorize/Authorize.svelte";
    import Docs from "./pages/docs/Docs.svelte";
    import Sign from "./pages/sign/Sign.svelte";
    import { auth, isAuthenticated, isLoading } from "./stores/auth";
    import { websocket } from "./stores/websocket";

    const routes = [
        { path: "/", component: Home },
        { path: "/login", component: Login },
        { path: "/register", component: Register },
        { path: "/dashboard", component: Dashboard },
        { path: "/dashboard/(.*)", component: Dashboard },
        { path: "/privacy", component: PrivacyPolicy },
        { path: "/terms", component: TermsOfService },
        { path: "/authorize", component: Authorize },
        { path: "/signin", component: Authorize },
        { path: "/docs(#.*)?", component: Docs },
        { path: "/sign", component: Sign },
    ];

    const statuses: Statuses = {
        [StatusCode.NotFound]: () => ({ component: NotFound }),
    };

    // Protected routes that require authentication
    const protectedRoutes = ["/dashboard", "/authorize", "/signin", "/sign"];

    // Routes that should redirect to dashboard if already authenticated
    const authRoutes = ["/login", "/register"];

    onMount(async () => {
        // Initialize auth state
        await auth.init();

        // Connect to WebSocket for real-time updates if authenticated
        const token = localStorage.getItem("ave_session_token");
        if (token) {
            websocket.connectAsUser(token);
        }
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
