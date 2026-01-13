<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "@mateothegreat/svelte5-router";
    import Text from "../../components/Text.svelte";
    import SidebarButton from "./components/SidebarButton.svelte";
    import Identity from "./pages/Identity.svelte";
    import Security from "./pages/Security.svelte";
    import MyData from "./pages/MyData.svelte";
    import Devices from "./pages/Devices.svelte";
    import ActivityLog from "./pages/ActivityLog.svelte";
    import LoginApproval from "./pages/LoginApproval.svelte";
    import { auth, identities as identitiesStore, isAuthenticated } from "../../stores/auth";
    import { websocket } from "../../stores/websocket";
    import { api, type Identity as IdentityType } from "../../lib/api";

    let selectedPage = $state<string>("");
    let pendingApprovals = $state(0);
    let mobileSidebarOpen = $state(false);

    let identities = $derived($identitiesStore);

    onMount(async () => {
        if (!$isAuthenticated) {
            goto("/login");
            return;
        }

        if (identities.length > 0) {
            selectedPage = identities[0].displayName;
        }

        try {
            const { requests } = await api.devices.getPendingRequests();
            pendingApprovals = requests.length;
        } catch (e) {
            console.error("Failed to fetch pending requests:", e);
        }

        websocket.onLoginRequest((request) => {
            pendingApprovals++;
        });
    });

    async function handleLogout() {
        await auth.logout();
        goto("/login");
    }

    async function handleNewIdentity() {
        selectedPage = "New Identity";
        mobileSidebarOpen = false;
    }

    function selectIdentity(identity: IdentityType) {
        selectedPage = identity.displayName;
        mobileSidebarOpen = false;
    }

    function selectPage(page: string) {
        selectedPage = page;
        mobileSidebarOpen = false;
    }

    let selectedIdentity = $derived(identities.find(i => i.displayName === selectedPage));
</script>

<div class="bg-[#090909] relative w-full min-h-screen-fixed flex flex-col md:flex-row px-4 md:px-[120px] py-6 md:py-[100px] gap-6 md:gap-[100px]">
    <button 
        class="mobile-menu-btn fixed top-4 right-4 z-50 p-2 bg-[#171717] rounded-full"
        onclick={() => mobileSidebarOpen = !mobileSidebarOpen}
    >
        {#if mobileSidebarOpen}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B9BBBE" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
        {:else}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B9BBBE" stroke-width="2">
                <path d="M3 12h18M3 6h18M3 18h18"/>
            </svg>
        {/if}
    </button>

    {#if mobileSidebarOpen}
        <div class="mobile-nav-overlay mobile-scroll-container py-12 px-6">
            <div class="flex flex-col gap-4 w-full max-w-sm">
                <Text type="hd" size={18} color="#878787">IDENTITIES</Text>
                {#each identities as identity}
                    <SidebarButton 
                        text={identity.displayName} 
                        bind:currentlySelected={selectedPage} 
                        onclick={() => selectIdentity(identity)} 
                        image={identity.avatarUrl || "/placeholder.png"} 
                    />
                {/each}
                {#if identities.length < 5}
                    <SidebarButton 
                        text="New Identity" 
                        bind:currentlySelected={selectedPage} 
                        onclick={handleNewIdentity} 
                        image="/icons/plus.svg" 
                    />
                {/if}
                
                <div class="h-px bg-[#878787]/20 w-full my-2"></div>
                
                <Text type="hd" size={18} color="#878787">ACCOUNT</Text>
                {#if pendingApprovals > 0}
                    <div class="relative">
                        <SidebarButton 
                            text="Login Requests" 
                            bind:currentlySelected={selectedPage} 
                            onclick={() => selectPage("Login Requests")} 
                        />
                        <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                            {pendingApprovals}
                        </span>
                    </div>
                {/if}
                <SidebarButton text="Security" bind:currentlySelected={selectedPage} onclick={() => selectPage("Security")} />
                <SidebarButton text="Devices" bind:currentlySelected={selectedPage} onclick={() => selectPage("Devices")} />
                <SidebarButton text="My Data" bind:currentlySelected={selectedPage} onclick={() => selectPage("My Data")} />
                <SidebarButton text="Activity Log" bind:currentlySelected={selectedPage} onclick={() => selectPage("Activity Log")} />
                
                <div class="h-px bg-[#878787]/20 w-full my-2"></div>
                <SidebarButton text="Logout" bind:currentlySelected={selectedPage} onclick={handleLogout} />
            </div>
        </div>
    {/if}

    <div class="hidden md:flex flex-col gap-[40px] w-[20%] z-10 desktop-nav">
        <div class="flex flex-col gap-[10px]">
            <Text type="hd" size={24} color="#878787">IDENTITIES</Text>
            {#each identities as identity}
                <SidebarButton 
                    text={identity.displayName} 
                    bind:currentlySelected={selectedPage} 
                    onclick={() => selectIdentity(identity)} 
                    image={identity.avatarUrl || "/placeholder.png"} 
                />
            {/each}
            {#if identities.length < 5}
                <SidebarButton 
                    text="New Identity" 
                    bind:currentlySelected={selectedPage} 
                    onclick={handleNewIdentity} 
                    image="/icons/plus.svg" 
                />
            {/if}
        </div>
        <div class="h-[1px] bg-[#878787]/20 w-full"></div>

        <div class="flex flex-col gap-[10px]">
            <Text type="hd" size={24} color="#878787">ACCOUNT</Text>
            {#if pendingApprovals > 0}
                <div class="relative">
                    <SidebarButton 
                        text="Login Requests" 
                        bind:currentlySelected={selectedPage} 
                        onclick={() => { selectedPage = "Login Requests"; }} 
                    />
                    <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                        {pendingApprovals}
                    </span>
                </div>
            {/if}
            <SidebarButton text="Security" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Security"; }} />
            <SidebarButton text="Devices" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Devices"; }} />
            <SidebarButton text="My Data" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "My Data"; }} />
            <SidebarButton text="Activity Log" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Activity Log"; }} />
        </div>
        <div class="h-[1px] bg-[#878787]/20 w-full"></div>
        <SidebarButton text="Logout" bind:currentlySelected={selectedPage} onclick={handleLogout} />
    </div>

    <div class="flex flex-col w-full md:w-[75%] z-10 mt-12 md:mt-0">
        {#if selectedIdentity}
            <Identity identity={selectedIdentity} />
        {:else if selectedPage === "New Identity"}
            <Identity newIdentity={true} />
        {:else if selectedPage === "Login Requests"}
            <LoginApproval bind:pendingCount={pendingApprovals} />
        {:else if selectedPage === "Security"}
            <Security />
        {:else if selectedPage === "Devices"}
            <Devices />
        {:else if selectedPage === "My Data"}
            <MyData />
        {:else if selectedPage === "Activity Log"}
            <ActivityLog />
        {:else}
            <div class="flex items-center justify-center h-full">
                <Text type="p" size={18} color="#878787">Select an option from the sidebar</Text>
            </div>
        {/if}
    </div>

    <img src="/grads/dashboard/dashboard_grad_tr.png" alt="gradient" class="absolute top-0 right-0 max-h-full pointer-events-none select-none" />
    <img src="/grads/dashboard/dashboard_grad_bl.png" alt="gradient" class="absolute inset-x-0 bottom-0 max-h-full max-w-[80%] pointer-events-none select-none"/>
</div>
