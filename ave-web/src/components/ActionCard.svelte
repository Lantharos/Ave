<script lang="ts">
    export let action: string;
    export let description: string;
    export let color: string = "#FFFFFF";
    export let buttons: Array<{ icon: string; color: string; onClick: () => void; loading?: boolean; disabled?: boolean; size?: number }>;

    function inferIconSize(icon: string): number {
        const match = icon.match(/-(\d+)\.(svg|png|jpg|jpeg|webp)$/i);
        if (!match) return 24;
        const parsed = Number(match[1]);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
    }

    if (!color) {
        color = "#FFFFFF";
    }

    for (const button of buttons) {
        if (!button.color) {
            button.color = "#FFFFFF";
        }
    }
</script>

<div class="flex flex-col md:flex-row w-full rounded-[20px] md:rounded-[36px] overflow-hidden gap-0 md:gap-[10px]">
    <div class="flex flex-col flex-grow bg-[#171717] p-3 md:p-[40px] gap-1 md:gap-[10px]">
        <h2 class="text-sm md:text-[18px] font-black" style="color: {color};">{action}</h2>
        <p class="text-[#878787] text-xs md:text-[18px]">{description}</p>
    </div>

    <div class="flex flex-row gap-0 md:gap-[20px]">
        {#each buttons as button}
            {@const iconSize = button.size ?? inferIconSize(button.icon)}
            <button
                    class="flex flex-row items-center justify-center flex-1 md:flex-none md:self-stretch md:w-[110px] px-5 py-4 md:px-0 md:py-0 bg-[#171717] text-[18px] hover:bg-[#202020] transition-colors duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style="color: {button.color}; --action-icon-size: {iconSize}px;"
                    on:click={button.onClick}
                    disabled={button.loading || button.disabled}
            >
                {#if button.loading}
                    <div class="action-card__icon border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                {:else}
                    <img src={button.icon} alt="icon" class="action-card__icon" />
                {/if}
            </button>
        {/each}
    </div>
</div>

<style>
    .action-card__icon {
        width: 16px;
        height: 16px;
    }

    @media (min-width: 768px) {
        .action-card__icon {
            width: var(--action-icon-size, 24px);
            height: var(--action-icon-size, 24px);
        }
    }
</style>
