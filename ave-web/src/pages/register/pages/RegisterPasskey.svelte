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

<div class="w-full min-h-screen flex flex-col items-start justify-center px-[150px] py-[150px] gap-[150px]">
    <div class="flex flex-col items-start justify-center gap-[100px] w-[70%] z-10">
        <div class="flex flex-col gap-[10px]">
            <Text type={"hd"} size={36}>
                WE'RE GOING TO SET UP YOUR PASSKEY NOW
            </Text>

            <Text type="p" size={24}>
                A passkey is a secure and convenient way to confirm actions on your Ave.
                <br><br>
                To set up your passkey:
                <br>
                1. Click the "Set Up Passkey" button below.
                <br>
                2. Follow the prompts on your device to complete the setup.
                <br>
                3. Ensure your device is secure and only accessible by you.
            </Text>
            
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
