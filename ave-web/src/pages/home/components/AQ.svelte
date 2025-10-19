<script lang="ts">
    export let question;
    export let answer;

    let isOpen = false;
    function toggle() {
        isOpen = !isOpen;
    }
</script>

<button class="bg-[#111111]/50 w-full {!isOpen ? 'rounded-full' : 'rounded-[32px]'} p-[20px] flex flex-col items-start gap-[10px] cursor-pointer" onclick={toggle}>
    <div class="w-full flex flex-row justify-between items-center">
        <h3 class="text-[#FFFFFF] text-[24px] font-normal">
            {question}
        </h3>
        <svg class="w-[24px] h-[24px] text-[#B9BBBE] transition-transform duration-300 {isOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
    </div>
    {#if isOpen}
        <p class="text-[#878787] text-[18px] text-left">
            {answer}
        </p>
    {/if}
</button>