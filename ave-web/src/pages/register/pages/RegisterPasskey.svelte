<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";
    import IdentityCard from "../../../components/IdentityCard.svelte";

    let { onNext } = $props<{ onNext?: () => void }>();
    function goNext() {
        onNext?.();
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
        </div>

        <Button text="SET UP PASSKEY" onclick={() => onNext()} icon="/icons/passkey-32-bk.svg" />
    </div>
</div>