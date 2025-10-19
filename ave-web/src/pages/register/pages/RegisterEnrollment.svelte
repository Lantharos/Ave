<script lang="ts">
    import ActionCard from "../../../components/ActionCard.svelte";
    import Text from "../../../components/Text.svelte";

    let { onEnroll } = $props<{ onEnroll?: (what: string) => void }>();
    function enroll(what: string) {
        onEnroll?.();
    }
</script>

<div class="w-full min-h-screen flex flex-col items-center justify-center px-[150px] py-[150px] gap-[150px]">
    <div class="w-[60%] h-auto flex flex-col items-center z-10 gap-[50px]">
        <div class="flex flex-col gap-[10px]">
            <Text type={"hd"} size={36}>LET'S MAKE SURE YOU DON'T LOSE ACCESS.</Text>
            <Text type="p" size={20}>
                Before you start using Raven, it’s recommended to enroll at least one or two trusted devices (like your phone or tablet). This ensures you can always verify logins, recover access, or approve changes — even if you lose your main one.
            </Text>
        </div>

        <div class="flex flex-col w-full gap-[10px]">
            <ActionCard action="ENROLL THIS DEVICE" description="Make this your first trusted device for verification." buttons={[
            { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: () => enroll("this") },
        ]} />

            <ActionCard action="ADD A NEW DEVICE" description="Scan a QR code on another phone or tablet to link it." buttons={[
            { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: () => enroll("qr") },
        ]} />
        </div>
    </div>
</div>
