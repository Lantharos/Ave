<script lang="ts">
    export let onclick: () => void;
    export let text: string;
    export let currentlySelected: string;
    export let image: string = "";
</script>

<button class="w-full {image !== '' ? 'px-2.5 md:px-[15px] py-2 md:py-[15px]' : 'px-4 md:px-[25px] py-2 md:py-[15px]' } {currentlySelected === text ? 'bg-[#B9BBBE]/20' : 'bg-transparent hover:bg-[#202020] transition-colors duration-300 cursor-pointer'} rounded-full flex flex-row items-center gap-2 md:gap-[15px]"
        onclick={onclick}>
    {#if image !== ""}
        <img src={image} alt="{text} icon" class="aspect-square h-6 md:h-[40px] w-auto object-contain rounded-full" />
    {/if}
    <span class="text-base md:text-[24px] font-medium {currentlySelected === text ? 'text-[#A8A8A8]' : 'text-[#878787]'}">
        {text}
    </span>
</button>