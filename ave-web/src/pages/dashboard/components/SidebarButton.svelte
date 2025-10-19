<script lang="ts">
    export let onclick: () => void;
    export let text: string;
    export let currentlySelected: string;
    export let image: string = "";
</script>

<button class="w-full {image !== '' ? 'px-[15px] py-[15px]' : 'px-[25px] py-[15px]' } {currentlySelected === text ? 'bg-[#B9BBBE]/20' : 'bg-transparent hover:bg-[#202020] transition-colors duration-300 cursor-pointer'} rounded-full flex flex-row items-center gap-[15px]"
        onclick={onclick}>
    {#if image !== ""}
        <img src={image} alt="{text} icon" class="aspect-square h-[40px] w-auto object-contain rounded-full" />
    {/if}
    <span class="text-[24px] font-medium {currentlySelected === text ? 'text-[#A8A8A8]' : 'text-[#878787]'}">
        {text}
    </span>
</button>