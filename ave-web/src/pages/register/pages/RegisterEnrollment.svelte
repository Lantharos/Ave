<script lang="ts">
    import ActionCard from "../../../components/ActionCard.svelte";
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";

    let { onComplete } = $props<{ 
        onComplete?: () => void;
    }>();

    function enrollThisDevice() {
        // This device is already enrolled during registration
        onComplete?.();
    }

    function skipForNow() {
        onComplete?.();
    }
</script>

<div class="w-full min-h-screen-fixed flex flex-col items-center justify-center px-[150px] py-[150px] gap-[150px]">
    <div class="w-[60%] h-auto flex flex-col items-center z-10 gap-[50px]">
        <div class="flex flex-col gap-[10px]">
            <Text type={"hd"} size={36}>YOU'RE ALL SET!</Text>
            <Text type="p" size={20}>
                Your Ave account has been created and this device is now enrolled as a trusted device. You can verify logins, recover access, or approve changes from here.
            </Text>
        </div>

        <div class="flex flex-col w-full gap-[10px]">
            <ActionCard 
                action="GO TO DASHBOARD" 
                description="Start using your Ave account." 
                buttons={[
                    { icon: "/icons/chevron-right-68.svg", color: "#32A94C", onClick: enrollThisDevice },
                ]} 
            />

            <ActionCard 
                action="ADD ANOTHER DEVICE" 
                description="Scan a QR code on another phone or tablet to link it." 
                buttons={[
                    { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: () => {} },
                ]} 
            />
        </div>
    </div>
</div>
