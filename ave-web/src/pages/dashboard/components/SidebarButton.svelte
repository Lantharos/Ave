<script lang="ts">
    export let onclick: () => void;
    export let text: string;
    export let currentlySelected: string;
</script>

<button class="w-full px-[25px] py-[15px] {currentlySelected === text ? 'bg-[#B9BBBE]/20' : 'bg-transparent hover:bg-[#202020] transition-colors duration-300 cursor-pointer'} rounded-[24px] flex flex-row items-center gap-[15px]"
        onclick={onclick}>
    <span class="text-[24px] font-medium {currentlySelected === text ? 'text-[#A8A8A8]' : 'text-[#878787]'}">
        {text}
    </span>
</button>