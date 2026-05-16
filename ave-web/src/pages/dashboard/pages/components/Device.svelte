<script lang="ts">
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

    function iconForDevice(type?: string): { src: string; alt: string } {
        if (type === "phone") return { src: "/icons/devices/phone-75.svg", alt: "Phone" };
        if (type === "tablet") return { src: "/icons/devices/tablet-75.svg", alt: "Tablet" };
        return { src: "/icons/devices/laptop-75.svg", alt: "Computer" };
    }

    const deviceIcon = $derived(iconForDevice(device.type));
    const deviceDetails = $derived(device.browser && device.os ? `${device.browser} on ${device.os}` : device.os || device.type || "Trusted device");
</script>

<div class="grid h-[268px] grid-rows-[1fr_54px] overflow-hidden rounded-[24px] bg-[#171717] shadow-[0_24px_60px_rgba(0,0,0,0.18)] md:h-[290px] md:rounded-[26px]">
    <div class="flex min-h-0 flex-col items-center justify-center px-5 py-6 text-center md:px-6 md:py-7">
        <img src={deviceIcon.src} alt={deviceIcon.alt} class="h-11 w-11 shrink-0 md:h-[52px] md:w-[52px]" />

        <h2 class="m-0 mt-5 line-clamp-2 min-h-[44px] max-w-full text-balance text-[20px] font-extrabold leading-[1.1] text-white md:min-h-[52px] md:text-[24px]">
            {device.name}
        </h2>

        <p class="m-0 mt-3 max-w-full truncate text-[14px] leading-5 text-[#B9BBBE] md:text-[16px]">
            {deviceDetails}
        </p>

        <p class="m-0 mt-2 max-w-full truncate text-[13px] leading-5 text-[#666666] tabular-nums md:text-[14px]">
            Last seen: {formatLastSeen(device.lastSeenAt)}
        </p>
    </div>

    <button 
        class="flex min-h-[54px] w-full items-center justify-center bg-[#1d1d1d] px-4 text-[13px] font-black text-[#FF5454] transition-[background-color,opacity,scale] duration-300 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-100 md:text-[15px] {device.isCurrent ? 'text-[#32A94C]' : 'hover:bg-[#232323]'}"
        onclick={() => onRevoke?.(device.id)}
        disabled={device.isCurrent || revoking}
        aria-label={device.isCurrent ? "Current device" : `Remove ${device.name}`}
    >
        {#if device.isCurrent}
            This device
        {:else if revoking}
            <div class="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
        {:else}
            <img src="/icons/devices/x-41.svg" alt="" class="h-7 w-7" />
        {/if}
    </button>
</div>
