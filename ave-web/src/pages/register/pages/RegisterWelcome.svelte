<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";

    let { onNext } = $props<{ onNext?: () => void }>();
    function goNext() {
        onNext?.();
    }
</script>

<div class="w-full min-h-screen-fixed flex flex-col items-center justify-center px-[150px] py-[150px] gap-[150px]">
    <div class="flex flex-row w-full items-start justify-between gap-[100px]">
        <div class="flex flex-col w-[55%] items-start justify-start gap-[20px]">
            <Text type="h" weight="medium" size={48}>
                Welcome to Ave.<br />
                Your new digital identity.
            </Text>

            <Text type="p" weight="normal" size={24}>
                Ave keeps who you are safe on your own device, never on ours.
                <br /><br />
                You'll set up your security layers once, and you're done.
                <br /><br />
                No passwords, no tracking, just you.
            </Text>
        </div>

        <div class="flex flex-col w-[40%] items-start justify-between gap-[10px]">
            <Text type="hd" size={18} cclass="ml-[30px] mb-[10px]">YOU'LL NEED</Text>

            <div class="flex flex-row w-full items-start gap-[20px] p-[30px] bg-[#171717]/80 rounded-[32px]">
                <!-- icon -->
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.375 9.375L22.25 12.25C22.4837 12.479 22.7978 12.6073 23.125 12.6073C23.4522 12.6073 23.7663 12.479 24 12.25L26.625 9.625C26.854 9.39134 26.9823 9.07719 26.9823 8.75C26.9823 8.42281 26.854 8.10866 26.625 7.875L23.75 5M26.25 2.5L14.25 14.5M16.25 19.375C16.25 23.172 13.172 26.25 9.375 26.25C5.57804 26.25 2.5 23.172 2.5 19.375C2.5 15.578 5.57804 12.5 9.375 12.5C13.172 12.5 16.25 15.578 16.25 19.375Z" stroke="#B9BBBE" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="text-[#B9BBBE] text-[18px] font-medium">A device that supports passkeys</span>
            </div>

            <div class="flex flex-row w-full items-start gap-[20px] p-[30px] bg-[#171717]/80 rounded-[32px]">
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.75 6.25H3.7625M3.75 15H3.7625M3.75 23.75H3.7625M10 6.25H26.25M10 15H26.25M10 23.75H26.25" stroke="#B9BBBE" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="text-[#B9BBBE] text-[18px] font-medium">A moment to create your recovery options</span>
            </div>

            <div class="flex flex-row w-full items-start gap-[20px] p-[30px] bg-[#171717]/80 rounded-[32px]">
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 22.5H15.0125M8.75 2.5H21.25C22.6307 2.5 23.75 3.61929 23.75 5V25C23.75 26.3807 22.6307 27.5 21.25 27.5H8.75C7.36929 27.5 6.25 26.3807 6.25 25V5C6.25 3.61929 7.36929 2.5 8.75 2.5Z" stroke="#B9BBBE" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="text-[#B9BBBE] text-[18px] font-medium">(Optional) another device nearby to link as trusted</span>
            </div>
        </div>
    </div>

    <div class="flex flex-col gap-[40px] w-[40%]">
        <Text type="hd" size={36} cclass="self-center">ARE YOU READY?</Text>

        <Button
                text="LET'S GO!"
                icon="/icons/chevronbk-right-38.svg"
                onclick={goNext}
        />
    </div>
</div>
