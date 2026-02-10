<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";
    import IdentityCard from "../../../components/IdentityCard.svelte";

    let { onNext, disabled = false } = $props<{ onNext?: () => void; disabled?: boolean }>();
    function goNext() {
        onNext?.();
    }
</script>

<div class="w-full min-h-screen-fixed flex flex-col items-center justify-center px-6 md:px-[150px] py-12 md:py-[150px] gap-8 md:gap-[150px]">
   <div class="flex flex-col items-center justify-center gap-4 md:gap-[10px] w-full md:w-[50%] z-10">
       <div class="flex flex-col bg-[#171717] p-5 md:p-[30px] rounded-[24px] md:rounded-[32px] gap-4 md:gap-[20px]">
           <h2 class="font-black text-[#D3D3D3] text-xl md:text-[36px]">
               TERMS OF SERVICE
           </h2>

           <p class="font-normal text-[#878787] text-sm md:text-[16px]">
               By clicking "I AGREE", you acknowledge that you have read and agree to Ave's <a href="/terms" target="_blank" class="hover:text-[#FFFFFF] text-[#A5A7AA] transition-colors duration-300 underline">Terms of Service</a>.
               <br><br>
               Please ensure you understand your rights and responsibilities while using our services.
               <br><br>
               If you do not agree to these terms, please exit the registration process.
           </p>
       </div>

       <div class="flex flex-col bg-[#171717] p-5 md:p-[30px] rounded-[24px] md:rounded-[32px] gap-4 md:gap-[20px]">
           <h2 class="font-black text-[#D3D3D3] text-xl md:text-[36px]">
               PRIVACY POLICY
           </h2>

           <p class="font-normal text-[#878787] text-sm md:text-[16px]">
               By clicking "I AGREE", you acknowledge that you have read and agree to Ave's <a href="/privacy" target="_blank" class="hover:text-[#FFFFFF] text-[#A5A7AA] transition-colors duration-300 underline">Privacy Policy</a>.
               <br><br>
               We are committed to protecting your personal information and ensuring your privacy while using our services.
               <br><br>
               If you do not agree to this policy, please exit the registration process.
           </p>
       </div>

       <Button text={disabled ? "PROCESSING..." : "I AGREE"} onclick={() => onNext?.()} icon="/icons/checkbk-32.svg" {disabled} />
   </div>
</div>
