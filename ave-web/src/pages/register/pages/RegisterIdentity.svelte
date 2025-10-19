<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";
    import IdentityCard from "../../../components/IdentityCard.svelte";

    let { onNext } = $props<{ onNext?: () => void }>();
    function goNext() {
        onNext?.();
    }
</script>

<div class="w-full min-h-screen flex flex-col items-center justify-center px-[150px] py-[150px] gap-[150px] overflow-auto scroll-smooth">
   <div class="flex flex-col items-center justify-center gap-[10px] w-[50%] z-10">
       <Text type={"hd"} size={36} cclass="self-center">
           WHO ARE YOU?
       </Text>

        <IdentityCard avatar="/placeholder.png" banner="" bannerColor="#FFFFFF" onUploadAvatar={(file) => {}} onChangeBanner={(fileOrHex) => {}}>
            <div class="flex flex-col gap-[10px]">
                <div class="p-[30px] bg-[#111111] rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">NAME</Text>
                    <input type="text" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" placeholder="Enter your name" />
                </div>
                <div class="p-[30px] bg-[#111111] rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">HANDLE</Text>
                    <input type="text" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" placeholder="Enter your handle" />
                </div>
                <div class="p-[30px] bg-[#111111] rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">EMAIL</Text>
                    <input type="text" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" placeholder="Enter your email" />
                </div>
                <div class="p-[30px] bg-[#111111] rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">BIRTHDAY</Text>
                    <input type="date" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" />
                </div>
            </div>
        </IdentityCard>

       <Button text="CONTINUE" onclick={() => goNext()} icon="/icons/chevronbk-right-38.svg" />
   </div>
</div>