<script lang="ts">
    import Router from 'svelte-spa-router';
    import Home from './pages/home/Home.svelte';
    import FAQ from './pages/home/FAQ.svelte';
    import NotFound from './pages/status/NotFound.svelte';
    import Login from "./pages/login/Login.svelte";
    import Register from "./pages/register/Register.svelte";
    import Dashboard from "./pages/dashboard/Dashboard.svelte";
    import PrivacyPolicy from "./pages/home/legal/PrivacyPolicy.svelte";
    import TermsOfService from "./pages/home/legal/TermsOfService.svelte";
    import Authorize from './pages/authorize/Authorize.svelte';

    const routes = {
        '/': Home,
        '/faq': FAQ,
        '/login': Login,
        '/register': Register,
        '/dashboard': Dashboard,
        '/privacy': PrivacyPolicy,
        '/terms': TermsOfService,
        '/authorize': Authorize,
        '*': NotFound
    };
</script>

<Router {routes}/>
