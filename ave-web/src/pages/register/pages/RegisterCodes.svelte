<script lang="ts">
    import Button from "../../../components/Button.svelte";

    let { onNext, trustCodes = [] } = $props<{
        onNext?: () => void;
        trustCodes?: string[];
    }>();

    let copiedCode = $state<string | null>(null);
    let copiedAll = $state(false);
    let confirmed = $state(false);

    async function copyCode(code: string) {
        await navigator.clipboard.writeText(code);
        copiedCode = code;
        setTimeout(() => {
            if (copiedCode === code) {
                copiedCode = null;
            }
        }, 2000);
    }

    async function copyAllCodes() {
        await navigator.clipboard.writeText(trustCodes.join("\n"));
        copiedAll = true;
        setTimeout(() => {
            copiedAll = false;
        }, 2000);
    }
</script>

<div class="w-full min-h-screen-fixed flex flex-col items-start justify-center px-6 md:px-[150px] py-12 md:py-[150px] gap-8 md:gap-[120px]">
    <div class="flex flex-col md:flex-row items-start justify-between gap-8 md:gap-[80px] w-full z-10">
        <div class="flex flex-col gap-4 md:gap-[14px] w-full md:w-[48%]">
            <h2 class="font-black text-[#D3D3D3] text-xl md:text-[36px]">SET UP RECOVERY</h2>

            <p class="font-normal text-[#878787] text-base md:text-[22px]">
                These recovery codes are for emergencies only.
                If you lose access to your passkeys, you can use one of these codes to get back into your account.
            </p>

            <p class="font-normal text-[#878787] text-base md:text-[22px]">
                Each code works once. After you use one, you'll have fewer remaining until you generate a new set.
            </p>

            <p class="font-normal text-[#878787] text-base md:text-[22px]">
                Save them somewhere you trust. You won't be able to see this set again after you continue.
            </p>
        </div>

        <div class="flex flex-col gap-2 md:gap-[10px] w-full md:w-[42%]">
            <div class="flex flex-col gap-2 md:gap-[10px] p-5 md:p-[30px] bg-[#171717] rounded-[24px] md:rounded-[32px]">
                <div class="flex items-center justify-between">
                    <span class="font-black text-[#878787] text-sm md:text-[16px]">RECOVERY CODES</span>
                    <button
                        class="cursor-pointer bg-[#222222] hover:bg-[#2A2A2A] text-white px-4 md:px-[15px] py-2 md:py-[10px] rounded-full text-sm md:text-[14px] font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        onclick={copyAllCodes}
                        disabled={trustCodes.length === 0}
                    >
                        {copiedAll ? "COPIED" : "COPY ALL"}
                    </button>
                </div>

                <div class="flex flex-col gap-2 md:gap-[10px]">
                    {#each trustCodes as code, index}
                        <div class="bg-[#111111] rounded-[20px] px-4 md:px-[20px] py-4 md:py-[18px] flex items-center justify-between gap-4">
                            <div class="flex flex-col gap-1 min-w-0">
                                <span class="text-[#666666] text-xs md:text-[14px]">Code {index + 1}</span>
                                <span class="font-medium text-white text-sm md:text-[20px] break-all">{code}</span>
                            </div>
                            <button
                                class="shrink-0 cursor-pointer bg-[#222222] hover:bg-[#2A2A2A] text-white px-4 md:px-[15px] py-2 md:py-[10px] rounded-full text-sm md:text-[14px] font-medium transition-colors duration-300"
                                onclick={() => copyCode(code)}
                            >
                                {copiedCode === code ? "COPIED" : "COPY"}
                            </button>
                        </div>
                    {/each}
                </div>
            </div>

            <button
                class="flex items-center gap-3 p-4 bg-[#171717] rounded-[20px] cursor-pointer text-left"
                onclick={() => { confirmed = !confirmed; }}
            >
                <span class={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${confirmed ? "bg-[#B9BBBE]" : "bg-[#222222]"}`}>
                    {#if confirmed}
                        <span class="w-2 h-2 rounded-full bg-[#090909]"></span>
                    {/if}
                </span>
                <span class="text-white text-sm md:text-[15px]">I saved these recovery codes somewhere safe</span>
            </button>

            <Button
                text="CONTINUE"
                onclick={() => onNext?.()}
                icon="/icons/chevronbk-right-38.svg"
                disabled={!confirmed}
            />
        </div>
    </div>
</div>
