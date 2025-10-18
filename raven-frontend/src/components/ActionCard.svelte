<script lang="ts">
    export let action: string;
    export let description: string;
    export let buttons: Array<{ icon: string; color: string; onClick: () => void }>;
</script>

<div class="flex flex-row w-full rounded-[36px] overflow-clip gap-[10px]">
    <div class="flex flex-col flex-grow bg-[#171717] p-[40px] gap-[10px]">
        <h2 class="text-[#FFFFFF] text-[18px] font-black">{action}</h2>
        <p class="text-[#878787] text-[18px]">{description}</p>
    </div>

    <div class="flex flex-row gap-[20px]">
        {#each buttons as button}
            <button class="flex flex-row items-center h-full w-fit gap-[10px] px-[40px] py-[10px] bg-[#171717] text-[18px] hover:bg-[#202020] transition-colors duration-300 cursor-pointer" style="color: {button.color};" onclick={button.onClick}>
                <img src={button.icon} alt="icon" />
            </button>
        {/each}
    </div>
</div>