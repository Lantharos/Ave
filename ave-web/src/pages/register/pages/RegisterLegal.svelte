<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";
    import IdentityCard from "../../../components/IdentityCard.svelte";

    let { onNext } = $props<{ onNext?: () => void }>();
    function goNext() {
        onNext?.();
    }
</script>

<div class="w-full min-h-screen flex flex-col items-center justify-center px-[150px] py-[150px] gap-[150px]">
   <div class="flex flex-col items-center justify-center gap-[10px] w-[50%] z-10">
       <div class="flex flex-col bg-[#171717] p-[30px] rounded-[32px] gap-[20px]">
           <Text type={"hd"} size={36}>
               TERMS OF SERVICE
           </Text>

           <Text type="p" size={16}>
               By clicking "I AGREE", you acknowledge that you have read and agree to Ave's <a href="/terms" target="_blank" class="hover:text-[#FFFFFF] text-[#A5A7AA] transition-colors duration-300 underline">Terms of Service</a>.
               <br><br>
               Please ensure you understand your rights and responsibilities while using our services.
               <br><br>
               If you do not agree to these terms, please exit the registration process.
           </Text>
       </div>

       <div class="flex flex-col bg-[#171717] p-[30px] rounded-[32px] gap-[20px]">
           <Text type={"hd"} size={36}>
               PRIVACY POLICY
           </Text>

           <Text type="p" size={16}>
               By clicking "I AGREE", you acknowledge that you have read and agree to Ave's <a href="/privacy" target="_blank" class="hover:text-[#FFFFFF] text-[#A5A7AA] transition-colors duration-300 underline">Privacy Policy</a>.
               <br><br>
               We are committed to protecting your personal information and ensuring your privacy while using our services.
               <br><br>
               If you do not agree to this policy, please exit the registration process.
           </Text>
       </div>

       <Button text="I AGREE" onclick={() => onNext()} icon="/icons/checkbk-32.svg" />
   </div>
</div>