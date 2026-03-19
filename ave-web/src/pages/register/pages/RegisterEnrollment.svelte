<script lang="ts">
    import ActionCard from "../../../components/ActionCard.svelte";
    import Text from "../../../components/Text.svelte";

    let { onComplete, onSetupRecovery, settingUpRecovery = false } = $props<{ 
        onComplete?: () => void;
        onSetupRecovery?: () => void;
        settingUpRecovery?: boolean;
    }>();
</script>

<div class="w-full min-h-screen-fixed flex flex-col items-center justify-center px-6 md:px-[150px] py-12 md:py-[150px] gap-8 md:gap-[150px]">
    <div class="w-full md:w-[60%] h-auto flex flex-col items-center z-10 gap-6 md:gap-[50px]">
        <div class="flex flex-col gap-4 md:gap-[10px] text-center md:text-left">
            <h2 class="font-black text-[#D3D3D3] text-xl md:text-[36px]">YOU'RE ALL SET!</h2>
            <p class="font-normal text-[#878787] text-base md:text-[20px]">
                Your Ave account is ready and this device is already signed in. You can keep going now, or set up recovery so you can get back in if you ever lose access to your passkeys.
            </p>
        </div>

        <div class="flex flex-col w-full gap-2 md:gap-[10px]">
            <ActionCard 
                action="SET UP RECOVERY" 
                description="Create one-time recovery codes for emergency access." 
                buttons={[
                    { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: () => onSetupRecovery?.(), loading: settingUpRecovery },
                ]} 
            />

            <ActionCard 
                action="DO THIS LATER" 
                description="You can finish setup in Security from any signed-in device." 
                buttons={[
                    { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: () => onComplete?.() },
                ]} 
            />
        </div>
    </div>
</div>
