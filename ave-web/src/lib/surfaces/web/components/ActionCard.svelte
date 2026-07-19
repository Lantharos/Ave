<script lang="ts">
    import type { Component } from "svelte";

    type ActionButton = {
        Icon: Component<any>;
        color?: string;
        onClick: () => void;
        loading?: boolean;
        disabled?: boolean;
        size?: number;
        strokeWidth?: number;
    };

    let { action, description, color = "#FFFFFF", buttons = [] } = $props<{
        action: string;
        description: string;
        color?: string;
        buttons: ActionButton[];
    }>();

</script>

<div class="flex flex-col md:flex-row w-full min-w-0 rounded-[20px] md:rounded-[36px] overflow-hidden gap-0 md:gap-[10px]">
    <div class="flex flex-col flex-grow min-w-0 bg-[#171717] p-3 md:p-[40px] gap-1 md:gap-[10px]">
        <h2 class="text-sm md:text-[18px] font-black" style="color: {color || '#FFFFFF'};">{action}</h2>
        <p class="text-[#878787] text-xs md:text-[18px]">{description}</p>
    </div>

    {#if buttons.length > 0}
        <div class="flex flex-row gap-0 md:gap-[20px]">
            {#each buttons as button (button)}
                {@const Icon = button.Icon}
                {@const iconSize = button.size ?? 68}
                <button
                        class="flex flex-row items-center justify-center flex-1 md:flex-none md:self-stretch md:w-[110px] px-5 py-4 md:px-0 md:py-0 bg-[#171717] text-[18px] hover:bg-[#202020] transition-colors duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style="color: {button.color || '#FFFFFF'}; --action-icon-size: {iconSize}px;"
                        onclick={button.onClick}
                        disabled={button.loading || button.disabled}
                >
                    {#if button.loading}
                        <div class="action-card__icon border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    {:else}
                        <Icon class="action-card__icon" size={iconSize} strokeWidth={button.strokeWidth ?? 2.8} />
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .action-card__icon {
        width: 16px;
        height: 16px;
    }

    /* Match the app-wide desktop breakpoint. */
    @media (min-width: 1441px) {
        .action-card__icon {
            width: var(--action-icon-size, 24px);
            height: var(--action-icon-size, 24px);
        }
    }
</style>
