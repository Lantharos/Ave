<script lang="ts">
    import Text from "../../../../components/Text.svelte";
    import type { Device as DeviceType } from "../../../../lib/api";

    interface Props {
        device: DeviceType;
        onRevoke?: (id: string) => void;
        revoking?: boolean;
    }

    let { device, onRevoke, revoking = false }: Props = $props();

    function formatLastSeen(dateStr?: string): string {
        if (!dateStr) return "Never";
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
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
            {:else}
                <img src="/icons/devices/laptop-75.svg" alt="device icon" class="mb-[10px]" />
            {/if}
        </div>
        <Text type="h" size={20} weight="bold" color="#FFFFFF">{device.name}</Text>
        {#if device.browser && device.os}
            <Text type="p" size={16} color="#B9BBBE">{device.browser} on {device.os}</Text>
        {:else if device.os}
            <Text type="p" size={16} color="#B9BBBE">{device.os}</Text>
        {/if}
        <Text type="p" size={14} color="#666666">Last seen: {formatLastSeen(device.lastSeenAt)}</Text>
    </div>
    <button 
        class="w-full max-h-full rounded-full bg-[#171717] hover:bg-[#202020] transition-colors duration-300 cursor-pointer flex items-center justify-center px-[20px] py-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={() => onRevoke?.(device.id)}
        disabled={device.isCurrent || revoking}
    >
        {#if device.isCurrent}
            <Text type="hd" size={16} color="#32A94C" cclass="my-[10px]">THIS DEVICE</Text>
        {:else if revoking}
            <div class="w-[20px] h-[20px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin my-[10px]"></div>
        {:else}
            <img src="/icons/devices/x-41.svg" alt="remove device" />
        {/if}
    </button>
</div>