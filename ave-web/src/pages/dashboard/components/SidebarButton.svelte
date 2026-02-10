<script lang="ts">
    export let onclick: () => void;
    export let text: string;
    export let currentlySelected: string;
    export let image: string = "";
    export let disabled: boolean = false;
</script>

<button
    class="w-full min-w-0 {image !== '' ? 'px-2.5 md:px-[15px] py-2 md:py-[15px]' : 'px-4 md:px-[25px] py-2 md:py-[15px]' } {currentlySelected === text ? 'bg-[#B9BBBE]/20' : 'bg-transparent'} {!disabled ? 'hover:bg-[#202020] transition-colors duration-300 cursor-pointer' : 'opacity-70 cursor-not-allowed'} rounded-full flex flex-row items-center gap-2 md:gap-[15px]"
    onclick={onclick}
    {disabled}
>
    {#if image !== ""}
        <img src={image} alt="{text} icon" class="aspect-square h-6 md:h-[40px] w-auto object-contain rounded-full" />
    {/if}
    <span class="block min-w-0 flex-1 truncate whitespace-nowrap text-left text-base md:text-[24px] font-medium {currentlySelected === text ? 'text-[#A8A8A8]' : 'text-[#878787]'}">
        {text}
    </span>
</button>
