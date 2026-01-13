<script lang="ts">
    let { onclick, text, icon, disabled = false } = $props<{
        onclick: () => void;
        text: string;
        icon: string;
        disabled?: boolean;
    }>();
</script>

<button 
    class="bg-[#B9BBBE] w-full px-4 md:px-[20px] py-3 md:py-[15px] text-base md:text-[24px] rounded-full text-[#090909] font-black transition-colors duration-300 flex flex-row items-center justify-between {disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#A1A1A1] cursor-pointer'}"
    onclick={onclick}
    {disabled}
>
    <img src={icon} alt="icon" class="w-6 md:w-[38px]" />
    {text}
    <span class="flex flex-col w-6 md:w-[38px]"></span>
</button>
