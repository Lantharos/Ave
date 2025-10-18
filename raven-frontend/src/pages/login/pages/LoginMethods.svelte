<script lang="ts">
    import ActionCard from "../../../components/ActionCard.svelte";

    export let loginPage: string;
</script>

<div class="w-[60%] h-auto flex flex-col items-center z-10 gap-[50px]">
    <h1 class="font-black text-[36px] text-[#FFFFFF]/80">PROVE IT'S YOU</h1>

    <div class="flex flex-col w-full gap-[10px]">
        <ActionCard action="CONFIRM ON A TRUSTED DEVICE" description="Approve this login on one of your other devices." buttons={[
            { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: () => loginPage = "trusted device" },
        ]} />

        <ActionCard action="USE TRUST CODES" description="Enter your trust codes to sign in." buttons={[
            { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: () => loginPage = "trust codes" },
        ]} />
    </div>
</div>
