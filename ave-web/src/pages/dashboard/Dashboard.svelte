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

    // Get identities from store
    let identities = $derived($identitiesStore);

    onMount(async () => {
        // Check if authenticated
        if (!$isAuthenticated) {
            goto("/login");
            return;
        }

        // Set default selected page
        if (identities.length > 0) {
            selectedPage = identities[0].displayName;
        }

        // Check for pending login requests
        try {
            const { requests } = await api.devices.getPendingRequests();
            pendingApprovals = requests.length;
        } catch (e) {
            console.error("Failed to fetch pending requests:", e);
        }

        // Listen for new login requests
        websocket.onLoginRequest((request) => {
            pendingApprovals++;
        });
    });

    async function handleLogout() {
        await auth.logout();
        goto("/login");
    }

    async function handleNewIdentity() {
        // Could open a modal or navigate to a new identity form
        selectedPage = "New Identity";
    }

    function selectIdentity(identity: IdentityType) {
        selectedPage = identity.displayName;
    }

    // Find selected identity
    let selectedIdentity = $derived(identities.find(i => i.displayName === selectedPage));
</script>

<div class="bg-[#090909] relative w-full min-h-screen flex flex-row px-[120px] py-[100px] gap-[100px]">
    <div class="flex flex-col gap-[40px] w-[20%] z-10">
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

    <div class="flex flex-col w-[75%] z-10">
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
