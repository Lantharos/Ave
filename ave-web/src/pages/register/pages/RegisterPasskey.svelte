<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";

    let { onNext } = $props<{ onNext?: () => void }>();
    
    let isLoading = $state(false);
    let error = $state("");
    
    async function handleSetupPasskey() {
        isLoading = true;
        error = "";
        
        try {
            onNext?.();
        } catch (e: any) {
            error = e.message || "Failed to set up passkey";
            isLoading = false;
        }
    }
</script>

<div class="w-full min-h-screen-fixed flex flex-col items-start justify-center px-6 md:px-[150px] py-12 md:py-[150px] gap-8 md:gap-[150px]">
    <div class="flex flex-col items-start justify-center gap-8 md:gap-[100px] w-full md:w-[70%] z-10">
        <div class="flex flex-col gap-4 md:gap-[10px]">
            <h2 class="font-black text-[#D3D3D3] text-xl md:text-[36px]">
                WE'RE GOING TO SET UP YOUR PASSKEY NOW
            </h2>

            <p class="font-normal text-[#878787] text-base md:text-[24px]">
                A passkey is a secure and convenient way to confirm actions on your Ave.
                <br><br>
                To set up your passkey:
                <br>
                1. Click the "Set Up Passkey" button below.
                <br>
                2. Follow the prompts on your device to complete the setup.
                <br>
                3. Ensure your device is secure and only accessible by you.
            </p>
            
            {#if error}
                <div class="bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-2xl mt-4">
                    {error}
                </div>
            {/if}
        </div>

        <Button 
            text={isLoading ? "SETTING UP..." : "SET UP PASSKEY"} 
            onclick={handleSetupPasskey} 
            icon="/icons/passkey-32-bk.svg"
            disabled={isLoading}
        />
    </div>
</div>
