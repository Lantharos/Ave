<script lang="ts">
    export let action: string;
    export let description: string;
    export let color: string = "#FFFFFF";
    export let buttons: Array<{ icon: string; color: string; onClick: () => void; loading?: boolean; disabled?: boolean }>;

    if (!color) {
        color = "#FFFFFF";
    }

    for (const button of buttons) {
        if (!button.color) {
            button.color = "#FFFFFF";
        }
    }
</script>

<div class="flex flex-col md:flex-row w-full rounded-[20px] md:rounded-[36px] overflow-clip gap-1.5 md:gap-[10px]">
    <div class="flex flex-col flex-grow bg-[#171717] p-3 md:p-[40px] gap-1 md:gap-[10px]">
        <h2 class="text-sm md:text-[18px] font-black" style="color: {color};">{action}</h2>
        <p class="text-[#878787] text-xs md:text-[18px]">{description}</p>
    </div>

    <div class="flex flex-row gap-1.5 md:gap-[20px] min-h-[60px] md:min-h-full">
        {#each buttons as button}
            <button
                    class="flex flex-row items-center justify-center flex-1 md:flex-none md:aspect-square w-fit h-full gap-2 md:gap-[10px] px-4 md:px-[40px] py-3 md:py-[10px] bg-[#171717] text-[18px] hover:bg-[#202020] transition-colors duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style="color: {button.color};"
                    on:click={button.onClick}
                    disabled={button.loading || button.disabled}
            >
                {#if button.loading}
                    <div class="w-4 h-4 md:w-[24px] md:h-[24px] border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                {:else}
                    <img src={button.icon} alt="icon" class="w-4 h-4 md:w-auto md:h-auto" />
                {/if}
            </button>
        {/each}
    </div>
</div>
