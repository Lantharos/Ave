<script lang="ts">
    import type { Component } from "svelte";

    let { onclick, text, Icon, disabled = false, iconStrokeWidth = 5 } = $props<{
        onclick: () => void;
        text: string;
        Icon: Component<any>;
        disabled?: boolean;
        iconStrokeWidth?: number;
    }>();
</script>

<button 
    class="bg-[#B9BBBE] w-full px-4 md:px-[20px] py-4 md:py-[15px] text-base md:text-[24px] rounded-full text-[#090909] font-black transition-colors duration-300 flex flex-row items-center justify-between {disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#A1A1A1] cursor-pointer'}"
    onclick={onclick}
    {disabled}
>
    <Icon class="h-5 w-5 shrink-0 md:h-[38px] md:w-[38px]" size={38} strokeWidth={iconStrokeWidth} />
    {text}
    <span class="flex flex-col w-5 md:w-[38px]"></span>
</button>
