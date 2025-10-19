<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";

    let { onNext } = $props<{ onNext?: () => void }>();
    function goNext() {
        onNext?.();
    }

    // trust code format: XXXXX-XXXXX-XXXXX-XXXXX, where X is a random alphanumeric character or symbol
    const generateRandomCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_+-=';
        let code = '';
        for (let i = 0; i < 25; i++) {
            if (i > 0 && i % 5 === 0) code += '-';
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const trustCode1 = generateRandomCode();
    const trustCode2 = generateRandomCode();
</script>

<div class="w-full min-h-screen flex flex-col items-start justify-center px-[150px] py-[150px] gap-[150px]">
    <div class="flex flex-row items-center justify-center gap-[100px] w-full z-10">
        <div class="flex flex-col gap-[10px] w-[50%]">
            <Text type={"hd"} size={36}>YOUR TRUST CODES</Text>

            <Text type="p" size={24}>
                These codes are your last resort for restoring access if you ever lose all your trusted devices.
                <br><br>
                Keep them somewhere safe — like where you’d store important documents such as your ID or birth certificate, as anyone with these codes can log in to your Ave.
            </Text>
        </div>

        <div class="flex flex-col gap-[10px] w-[40%]">
            <div class="flex flex-col gap-[10px] p-[30px] bg-[#171717] rounded-[32px]">
                <Text type="hd" size={16} color="#878787">PRIMARY TRUST CODE</Text>
                <Text type="h" size={24} color="#FFFFFF">{trustCode1}</Text>
                <button class="cursor-pointer bg-[#333333] hover:bg-[#444444] text-white px-[15px] py-[10px] rounded-full text-[16px] font-medium transition-colors duration-300"
                        onclick={() => {
                            navigator.clipboard.writeText(trustCode1);
                        }}>
                    <Text type="h" size={16} color="#D3D3D3" weight="black">COPY TO CLIPBOARD</Text>
                </button>
            </div>

            <div class="flex flex-col gap-[10px] p-[30px] bg-[#171717] rounded-[32px]">
                <Text type="hd" size={16} color="#878787">BACKUP TRUST CODE</Text>
                <Text type="h" size={24} color="#FFFFFF">{trustCode2}</Text>
                <button class="cursor-pointer bg-[#333333] hover:bg-[#444444] text-white px-[15px] py-[10px] rounded-full text-[16px] font-medium transition-colors duration-300"
                        onclick={() => {
                            navigator.clipboard.writeText(trustCode2);
                        }}>
                    <Text type="h" size={16} color="#D3D3D3" weight="black">COPY TO CLIPBOARD</Text>
                </button>
            </div>

            <Button text="CONTINUE" onclick={() => onNext()} icon="/icons/chevronbk-right-38.svg" />
        </div>
    </div>
</div>