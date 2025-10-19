<script lang="ts">
    export let action: string;
    export let description: string;
    export let color: string = "#FFFFFF";
    export let buttons: Array<{ icon: string; color: string; onClick: () => void }>;

    if (!color) {
        color = "#FFFFFF";
    }

    for (const button of buttons) {
        if (!button.color) {
            button.color = "#FFFFFF";
        }
    }
</script>

<div class="flex flex-row w-full rounded-[36px] overflow-clip gap-[10px]">
    <div class="flex flex-col flex-grow bg-[#171717] p-[40px] gap-[10px]">
        <h2 class="text-[{color}] text-[18px] font-black">{action}</h2>
        <p class="text-[#878787] text-[18px]">{description}</p>
    </div>

    <div class="flex flex-row gap-[20px] min-h-full">
        {#each buttons as button}
            <button
                    class="flex flex-row items-center justify-center aspect-square w-fit h-full gap-[10px] px-[40px] py-[10px] bg-[#171717] text-[18px] hover:bg-[#202020] transition-colors duration-300 cursor-pointer"
                    style="color: {button.color};"
                    on:click={button.onClick}
            >
                <img src={button.icon} alt="icon" />
            </button>
        {/each}
    </div>
</div>
