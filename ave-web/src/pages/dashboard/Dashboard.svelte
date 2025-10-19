<script lang="ts">
    import Text from "../../components/Text.svelte";
    import SidebarButton from "./components/SidebarButton.svelte";
    import Identity from "./pages/Identity.svelte";
    import Security from "./pages/Security.svelte";
    import MyData from "./pages/MyData.svelte";
    import Devices from "./pages/Devices.svelte";

    let identities = [{
        name: "Niko Arden",
        handle: "arden",
        email: "",
        birthday: "",
        avatar: "/placeholder.png",
        banner: "",
        bannerColor: "#B9BBBE"
    }]

    let selectedPage: string = identities[0].name;
</script>

<div class="bg-[#090909] relative w-full min-h-screen flex flex-row px-[120px] py-[100px] gap-[100px]">
    <div class="flex flex-col gap-[40px] w-[20%] z-10">
        <div class="flex flex-col gap-[10px]">
            <Text type="hd" size={24} color="#878787">IDENTITIES</Text>
            {#each identities as identity}
                <SidebarButton text={identity.name} bind:currentlySelected={selectedPage} onclick={() => { selectedPage = identity.name; }} image={identity.avatar} />
            {/each}
            <SidebarButton text="New Identity" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "New Identity"; }} image="/icons/plus.svg" />
        </div>
        <div class="h-[1px] bg-[#878787]/20 w-full"></div>

        <div class="flex flex-col gap-[10px]">
            <Text type="hd" size={24} color="#878787">ACCOUNT</Text>
            <SidebarButton text="Security" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Security"; }} />
            <SidebarButton text="Devices" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Devices"; }} />
            <SidebarButton text="My Data" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "My Data"; }} />
            <SidebarButton text="Activity Log" bind:currentlySelected={selectedPage} onclick={() => { selectedPage = "Activity Log"; }} />
        </div>
        <div class="h-[1px] bg-[#878787]/20 w-full"></div>
        <SidebarButton text="Logout" bind:currentlySelected={selectedPage} onclick={() => {}} />
    </div>

    <div class="flex flex-col w-[75%] z-10">
        {#if identities.find(identity => identity.name === selectedPage)}
            <Identity identity={identities.find(identity => identity.name === selectedPage)} />
        {:else if selectedPage === "New Identity"}
            <Identity newIdentity={true} />
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
