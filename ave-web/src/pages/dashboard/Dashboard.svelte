<script lang="ts">
    import Text from "../../components/Text.svelte";
    import SidebarButton from "./components/SidebarButton.svelte";
    import Identity from "./pages/Identity.svelte";
    import Security from "./pages/Security.svelte";
    import MyData from "./pages/MyData.svelte";
    import Devices from "./pages/Devices.svelte";

    let selectedPage: string = "Identity";
</script>

<div class="bg-[#090909] relative w-full min-h-screen flex flex-row px-[120px] py-[100px] gap-[100px]">
    <div class="flex flex-col gap-[40px] w-[20%] z-10">
        <div class="flex flex-col gap-[10px]">
            <Text type="hd" size={24} color="#878787">ACCOUNT</Text>
            <SidebarButton text="Identity" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Identity"; }} />
            <SidebarButton text="Security" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Security"; }} />
            <SidebarButton text="Devices" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Devices"; }} />
            <SidebarButton text="My Data" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "My Data"; }} />
        </div>
        <div class="h-[1px] bg-[#878787]/20 w-full"></div>
        <div class="flex flex-col gap-[10px]">
            <Text type="hd" size={24} color="#878787">SYSTEM</Text>
            <SidebarButton text="Apps" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Apps"; }} />
            <SidebarButton text="Billing" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Billing"; }} />
            <SidebarButton text="Activity Log" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Activity Log"; }} />
        </div>
        <div class="h-[1px] bg-[#878787]/20 w-full"></div>
        <SidebarButton text="Logout" bind:currentlySelected={selectedPage} onclick={() => {}} />
    </div>

    <div class="flex flex-col w-[75%] z-10">
        {#if selectedPage === "Identity"}
            <Identity />
        {:else if selectedPage === "Security"}
            <Security />
        {:else if selectedPage === "Devices"}
            <Devices />
        {:else if selectedPage === "My Data"}
            <MyData />
        {/if}
    </div>

    <img src="/grads/dashboard/dashboard_grad_tr.png" alt="gradient" class="absolute top-0 right-0 max-h-full pointer-events-none select-none" />
    <img src="/grads/dashboard/dashboard_grad_bl.png" alt="gradient" class="absolute inset-x-0 bottom-0 max-h-full max-w-[80%] pointer-events-none select-none"/>
</div>
