<script lang="ts">
    export let device: {
        type: string,
        hostname: string,
        ip: string,
        location: string,
        primary: boolean
    };

    import Text from "../../../../components/Text.svelte";
</script>

<div class="flex flex-col gap-[3px] h-full">
    <div class="flex flex-col bg-[#171717] rounded-[24px] p-[20px] gap-[10px] items-center justify-center">
        <div class="w-[50px] aspect-square">
            {#if device.type === 'phone'}
                <img src="/icons/devices/phone-75.svg" alt="phone icon" class="mb-[10px]" />
            {:else if device.type === 'computer'}
                <img src="/icons/devices/laptop-75.svg" alt="computer icon" class="mb-[10px]" />
            {:else if device.type === 'tablet'}
                <img src="/icons/devices/tablet-75.svg" alt="tablet icon" class="mb-[10px]" />
            {/if}
        </div>
        <Text type="h" size={20} weight="bold" color="#FFFFFF">{device.hostname}</Text>
        <Text type="p" size={18} color="#B9BBBE">{device.ip}</Text>
        <Text type="p" size={18} color="#B9BBBE">{device.location}</Text>
    </div>
    <div class="w-full max-h-full rounded-full bg-[#171717] hover:bg-[#202020] transition-colors duration-300 cursor-pointer flex items-center justify-center px-[20px] py-[10px]">
        {#if device.primary}
            <Text type="hd" size={16} color="#32A94C" cclass="my-[10px]">PRIMARY DEVICE</Text>
        {:else}
            <img src="/icons/devices/x-41.svg" alt="remove device" />
        {/if}
    </div>
</div>