<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";

    let { onNext, trustCodes = [] } = $props<{ 
        onNext?: () => void;
        trustCodes?: string[];
    }>();
    
    let copied = $state<[boolean, boolean]>([false, false]);
    let confirmed = $state(false);

    function copyCode(index: 0 | 1, code: string) {
        navigator.clipboard.writeText(code);
        copied[index] = true;
        setTimeout(() => {
            copied[index] = false;
        }, 2000);
    }

    let canContinue = $derived(confirmed);
</script>

<div class="w-full min-h-screen-fixed flex flex-col items-start justify-center px-6 md:px-[150px] py-12 md:py-[150px] gap-8 md:gap-[150px]">
    <div class="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-[100px] w-full z-10">
        <div class="flex flex-col gap-4 md:gap-[10px] w-full md:w-[50%]">
            <h2 class="font-black text-[#D3D3D3] text-xl md:text-[36px]">YOUR TRUST CODES</h2>

            <p class="font-normal text-[#878787] text-base md:text-[24px]">
                These codes are your last resort for restoring access if you ever lose all your trusted devices.
                <br><br>
                Keep them somewhere safe — like where you'd store important documents such as your ID or birth certificate, as anyone with these codes can log in to your Ave.
                <br><br>
                <span class="text-yellow-500">Write them down or save them securely. You won't be able to see them again.</span>
            </p>
        </div>

        <div class="flex flex-col gap-2 md:gap-[10px] w-full md:w-[40%]">
            <div class="flex flex-col gap-2 md:gap-[10px] p-5 md:p-[30px] bg-[#171717] rounded-[24px] md:rounded-[32px]">
                <span class="font-black text-[#878787] text-sm md:text-[16px]">PRIMARY TRUST CODE</span>
                <span class="font-medium text-white text-lg md:text-[24px] break-all">{trustCodes[0] ?? "Loading..."}</span>
                <button 
                    class="cursor-pointer bg-[#333333] hover:bg-[#444444] text-white px-4 md:px-[15px] py-2 md:py-[10px] rounded-full text-sm md:text-[16px] font-medium transition-colors duration-300"
                    onclick={() => copyCode(0, trustCodes[0])}
                    disabled={!trustCodes[0]}
                >
                    <span class="font-black text-[#D3D3D3]">
                        {copied[0] ? "COPIED!" : "COPY TO CLIPBOARD"}
                    </span>
                </button>
            </div>

            <div class="flex flex-col gap-2 md:gap-[10px] p-5 md:p-[30px] bg-[#171717] rounded-[24px] md:rounded-[32px]">
                <span class="font-black text-[#878787] text-sm md:text-[16px]">BACKUP TRUST CODE</span>
                <span class="font-medium text-white text-lg md:text-[24px] break-all">{trustCodes[1] ?? "Loading..."}</span>
                <button 
                    class="cursor-pointer bg-[#333333] hover:bg-[#444444] text-white px-4 md:px-[15px] py-2 md:py-[10px] rounded-full text-sm md:text-[16px] font-medium transition-colors duration-300"
                    onclick={() => copyCode(1, trustCodes[1])}
                    disabled={!trustCodes[1]}
                >
                    <span class="font-black text-[#D3D3D3]">
                        {copied[1] ? "COPIED!" : "COPY TO CLIPBOARD"}
                    </span>
                </button>
            </div>

            <label class="flex items-center gap-3 p-4 bg-[#171717] rounded-2xl cursor-pointer">
                <input 
                    type="checkbox" 
                    class="w-5 h-5 accent-white"
                    bind:checked={confirmed}
                />
                <span class="text-white text-sm">I have saved my trust codes somewhere safe</span>
            </label>

            <Button 
                text="CONTINUE" 
                onclick={() => onNext?.()} 
                icon="/icons/chevronbk-right-38.svg"
                disabled={!canContinue}
            />
        </div>
    </div>
</div>
