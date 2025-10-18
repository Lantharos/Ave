<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";

    let { onNext } = $props<{ onNext?: () => void }>();
    function goNext() {
        onNext?.();
    }

    // trust code format: XXXX-XXXX-XXXX-XXXX, where X is a random alphanumeric character
    const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        for (let i = 0; i < 16; i++) {
            if (i > 0 && i % 4 === 0) code += '-';
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const randomTrustCode = generateRandomCode();
</script>

<div class="w-full min-h-screen flex flex-col items-start justify-center px-[150px] py-[150px] gap-[150px]">
    <div class="flex flex-row items-center justify-center gap-[100px] w-full z-10">
        <div class="flex flex-col gap-[10px] w-[50%]">
            <Text type={"hd"} size={36}>YOUR TRUST CODES</Text>

            <Text type="p" size={24}>
                These codes are your last resort for restoring access if you ever lose all your trusted devices.
                <br><br>
                Keep them somewhere safe — like where you’d store important documents such as your ID or birth certificate, as anyone with these codes can log in to your ID.
            </Text>
        </div>

        <div class="flex flex-col gap-[10px] w-[40%]">
            <div class="flex flex-col gap-[10px] p-[30px] bg-[#171717] rounded-[32px]">
                <Text type="hd" size={16} color="#878787">RANDOM TRUST CODE</Text>
                <Text type="h" size={24} color="#FFFFFF">{randomTrustCode}</Text>
                <button class="cursor-pointer bg-[#333333] hover:bg-[#444444] text-white px-[15px] py-[10px] rounded-full text-[16px] font-medium transition-colors duration-300"
                        onclick={() => {
                            navigator.clipboard.writeText(randomTrustCode);
                        }}>
                    <Text type="h" size={16} color="#D3D3D3" weight="black">COPY TO CLIPBOARD</Text>
                </button>
            </div>

            <div class="flex flex-col gap-[10px] p-[30px] bg-[#171717] rounded-[32px]">
                <Text type="hd" size={16} color="#878787">CUSTOM TRUST CODE</Text>
                <input type="text" class="w-full bg-[#111111] rounded-full mt-[10px] px-[20px] py-[15px] text-white focus:outline-none" placeholder="e.g. KITT-ENLO-VER1-2345" />
            </div>

            <Button text="CONTINUE" onclick={() => onNext()} icon="/icons/chevronbk-right-38.svg" />
        </div>
    </div>
</div>