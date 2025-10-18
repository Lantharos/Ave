<script lang="ts">
    import LoginMethods from "./pages/LoginMethods.svelte";
    import LoginStart from "./pages/LoginStart.svelte";

    let currentPage = "login";
</script>

<div class="bg-[#090909] w-full h-screen flex flex-col items-center justify-center">
    {#if (currentPage === "login")}
        <LoginStart bind:loginPage={currentPage} />
    {:else if (currentPage === "methods")}
        <LoginMethods bind:loginPage={currentPage} />
    {/if}

    <img src="/grads/login_grad.png" class="absolute bottom-0 left-0 w-full h-auto pointer-events-none select-none" alt="gradient"/>
</div>
