<script lang="ts">
    export let onclick: () => void;
    export let text: string;
    export let icon: string;
</script>

<button class="bg-[#B9BBBE] w-full px-[20px] py-[15px] text-[24px] rounded-full text-[#090909] font-black hover:bg-[#A1A1A1] transition-colors duration-300 cursor-pointer flex flex-row items-center justify-between"
        onclick={onclick}>
    <img src={icon} alt="icon" class="w-[38px]" />

    {text}

    <span class="flex flex-col w-[38px]"></span>
</button>