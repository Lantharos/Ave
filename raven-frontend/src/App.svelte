<script lang="ts">
    import Router from 'svelte-spa-router';
    import Home from './pages/home/Home.svelte';
    import FAQ from './pages/home/FAQ.svelte';
    import NotFound from './pages/status/NotFound.svelte';
    import Login from "./pages/login/Login.svelte";
    import Register from "./pages/register/Register.svelte";
    import Dashboard from "./pages/dashboard/Dashboard.svelte";

    const routes = {
        '/': Home,
        '/faq': FAQ,
        '/login': Login,
        '/register': Register,
        '/dashboard': Dashboard,
        '*': NotFound
    };
</script>

<Router {routes}/>
