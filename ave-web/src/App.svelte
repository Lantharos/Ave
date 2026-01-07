<script lang="ts">
    import Router, { replace } from 'svelte-spa-router';
    import { onMount } from 'svelte';
    import Home from './pages/home/Home.svelte';
    import FAQ from './pages/home/FAQ.svelte';
    import NotFound from './pages/status/NotFound.svelte';
    import Login from "./pages/login/Login.svelte";
    import Register from "./pages/register/Register.svelte";
    import Dashboard from "./pages/dashboard/Dashboard.svelte";
    import PrivacyPolicy from "./pages/home/legal/PrivacyPolicy.svelte";
    import TermsOfService from "./pages/home/legal/TermsOfService.svelte";
    import Authorize from './pages/authorize/Authorize.svelte';
    import { auth, isAuthenticated, isLoading } from './stores/auth';
    import { websocket } from './stores/websocket';

    const routes = {
        '/': Home,
        '/faq': FAQ,
        '/login': Login,
        '/register': Register,
        '/dashboard': Dashboard,
        '/dashboard/*': Dashboard,
        '/privacy': PrivacyPolicy,
        '/terms': TermsOfService,
        '/authorize': Authorize,
        '*': NotFound
    };

    // Protected routes that require authentication
    const protectedRoutes = ['/dashboard', '/authorize'];

    // Routes that should redirect to dashboard if already authenticated
    const authRoutes = ['/login', '/register'];

    onMount(async () => {
        // Initialize auth state
        await auth.init();
        
        // Connect to WebSocket for real-time updates if authenticated
        const token = localStorage.getItem('ave_session_token');
        if (token) {
            websocket.connectAsUser(token);
        }
    });
</script>

{#if $isLoading}
    <div class="bg-[#090909] w-full h-screen grid place-items-center">
        <div class="w-12 h-12 border-4 border-transparent border-t-white rounded-full animate-spin"></div>
    </div>
{:else}
    <Router {routes} />
{/if}
