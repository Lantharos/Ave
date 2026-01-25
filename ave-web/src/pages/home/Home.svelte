<script lang="ts">
    import Text from "../../components/Text.svelte";
    import { goto, route } from "@mateothegreat/svelte5-router";

    let mobileMenuOpen = $state(false);
</script>

<div class="bg-[#090909] w-full min-h-screen-fixed flex flex-col items-start px-6 md:px-[200px] py-12 md:py-[100px] gap-12 md:gap-[100px] relative overflow-auto">
    <button 
        class="mobile-menu-btn fixed top-4 right-4 z-50 p-2 bg-[#171717] rounded-full"
        onclick={() => mobileMenuOpen = !mobileMenuOpen}
    >
        {#if mobileMenuOpen}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B9BBBE" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
        {:else}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B9BBBE" stroke-width="2">
                <path d="M3 12h18M3 6h18M3 18h18"/>
            </svg>
        {/if}
    </button>

    {#if mobileMenuOpen}
        <div class="mobile-nav-overlay">
            <a href="/" use:route class="px-6 py-3 bg-[#171717] rounded-full text-[#B9BBBE] text-lg" onclick={() => mobileMenuOpen = false}>
                about
            </a>
            <a href="/login" use:route class="px-6 py-3 text-[#B9BBBE] text-lg" onclick={() => mobileMenuOpen = false}>
                login
            </a>
            <a href="/register" use:route class="px-6 py-3 text-[#B9BBBE] text-lg" onclick={() => mobileMenuOpen = false}>
                new id
            </a>
            <a href="/docs" use:route class="px-6 py-3 text-[#B9BBBE] text-lg" onclick={() => mobileMenuOpen = false}>
                docs
            </a>
            <a href="/faq" use:route class="px-6 py-3 text-[#B9BBBE] text-lg" onclick={() => mobileMenuOpen = false}>
                faq
            </a>
            <div class="h-px w-32 bg-[#333] my-4"></div>
            <a href="/privacy" use:route class="text-[#A5A7AA] text-base" onclick={() => mobileMenuOpen = false}>
                privacy policy
            </a>
            <a href="/terms" use:route class="text-[#A5A7AA] text-base" onclick={() => mobileMenuOpen = false}>
                terms of service
            </a>
        </div>
    {/if}

    <div class="hidden md:flex flex-row w-full justify-between items-start desktop-nav">
        <div class="flex flex-row">
            <button class="px-[40px] py-[20px] bg-[#171717] rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                about
            </button>
            <a href="/login" use:route class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                login
            </a>
            <a href="/register" use:route class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                new id
            </a>
            <a href="https://devs.aveid.net" class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                devs
            </a>
            <a href="/docs" use:route class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                docs
            </a>
            <a href="/faq" use:route class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                faq
            </a>
        </div>

        <div class="flex flex-col items-end justify-end">
            <a href="/privacy" use:route class="cursor-pointer hover:text-[#FFFFFF] hover:underline transition-all duration-300 rounded-full flex items-center justify-center text-[#A5A7AA] text-[24px]">
                privacy policy
            </a>
            <a href="/terms" use:route class="cursor-pointer hover:text-[#FFFFFF] hover:underline transition-all duration-300 rounded-full flex items-center justify-center text-[#A5A7AA] text-[24px]">
                terms of service
            </a>
        </div>
    </div>

    <div class="flex flex-col w-full items-start justify-center gap-2 md:gap-[10px] z-10 mt-8 md:mt-0">
        <h1 class="font-bold text-white text-4xl md:text-[96px]">
            Meet Ave.
        </h1>

        <h2 class="font-medium text-[#D3D3D3] text-lg md:text-[36px]">
            Not another login. Not another password. Just <span class="italic underline">you</span>.
        </h2>

        <p class="font-normal text-[#878787] text-base md:text-[36px] mt-8 md:mt-[10%] max-w-full md:max-w-[80%]">
            No tracking, no profiles, no middlemen. Just a clean, secure way to prove who you are and connect safely anywhere.
        </p>
    </div>

    <img src="/grads/home_grad.png" class="absolute bottom-0 left-0 w-full h-auto pointer-events-none select-none" alt="gradient"/>
</div>
