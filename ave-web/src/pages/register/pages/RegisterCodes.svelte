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

<div class="w-full min-h-screen-fixed flex flex-col items-start justify-center px-[150px] py-[150px] gap-[150px]">
    <div class="flex flex-row items-center justify-center gap-[100px] w-full z-10">
        <div class="flex flex-col gap-[10px] w-[50%]">
            <Text type={"hd"} size={36}>YOUR TRUST CODES</Text>

            <Text type="p" size={24}>
                These codes are your last resort for restoring access if you ever lose all your trusted devices.
                <br><br>
                Keep them somewhere safe — like where you'd store important documents such as your ID or birth certificate, as anyone with these codes can log in to your Ave.
                <br><br>
                <span class="text-yellow-500">Write them down or save them securely. You won't be able to see them again.</span>
            </Text>
        </div>

        <div class="flex flex-col gap-[10px] w-[40%]">
            <div class="flex flex-col gap-[10px] p-[30px] bg-[#171717] rounded-[32px]">
                <Text type="hd" size={16} color="#878787">PRIMARY TRUST CODE</Text>
                <Text type="h" size={24} color="#FFFFFF">{trustCodes[0] ?? "Loading..."}</Text>
                <button 
                    class="cursor-pointer bg-[#333333] hover:bg-[#444444] text-white px-[15px] py-[10px] rounded-full text-[16px] font-medium transition-colors duration-300"
                    onclick={() => copyCode(0, trustCodes[0])}
                    disabled={!trustCodes[0]}
                >
                    <Text type="h" size={16} color="#D3D3D3" weight="black">
                        {copied[0] ? "COPIED!" : "COPY TO CLIPBOARD"}
                    </Text>
                </button>
            </div>

            <div class="flex flex-col gap-[10px] p-[30px] bg-[#171717] rounded-[32px]">
                <Text type="hd" size={16} color="#878787">BACKUP TRUST CODE</Text>
                <Text type="h" size={24} color="#FFFFFF">{trustCodes[1] ?? "Loading..."}</Text>
                <button 
                    class="cursor-pointer bg-[#333333] hover:bg-[#444444] text-white px-[15px] py-[10px] rounded-full text-[16px] font-medium transition-colors duration-300"
                    onclick={() => copyCode(1, trustCodes[1])}
                    disabled={!trustCodes[1]}
                >
                    <Text type="h" size={16} color="#D3D3D3" weight="black">
                        {copied[1] ? "COPIED!" : "COPY TO CLIPBOARD"}
                    </Text>
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
