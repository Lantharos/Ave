<script lang="ts">
    import type { ConnectedApp } from "$lib/surfaces/web/lib/api";
    import { Lock, X } from "@lucide/svelte";

    interface Props {
        app: ConnectedApp;
        identityLabel: string | null;
        onRevoke: (id: string) => void;
        revoking?: boolean;
    }

    let { app, identityLabel, onRevoke, revoking = false }: Props = $props();

    let confirming = $state(false);

    function formatLastUsed(dateStr: string | null): string {
        if (!dateStr) return "Never";
        const date = new Date(dateStr);
        const diff = Date.now() - date.getTime();
        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    const websiteHost = $derived.by(() => {
        if (!app.appWebsite) return null;
        try {
            return new URL(app.appWebsite).hostname;
        } catch {
            return null;
        }
    });
</script>

<div class="grid h-[268px] grid-rows-[1fr_54px] overflow-hidden rounded-[24px] bg-[#171717] shadow-[0_24px_60px_rgba(0,0,0,0.18)] md:h-[290px] md:rounded-[26px]">
    {#if confirming}
        <div class="flex min-h-0 flex-col items-center justify-center px-5 py-6 text-center md:px-6">
            <h2 class="m-0 text-[20px] font-extrabold leading-[1.1] text-white md:text-[22px]">Disconnect {app.appName}?</h2>
            <p class="m-0 mt-3 text-[14px] leading-5 text-[#B9BBBE]">
                {#if app.encrypted}
                    Your key for this app is deleted, so what it encrypted for you can't be read again.
                {:else}
                    The app loses access until you sign in to it again.
                {/if}
            </p>
            <button class="mt-4 border-0 bg-transparent text-[14px] text-[#878787] cursor-pointer hover:text-white transition-colors duration-300" onclick={() => (confirming = false)}>
                Keep connected
            </button>
        </div>
    {:else}
        <div class="flex min-h-0 flex-col items-center justify-center px-5 py-6 text-center md:px-6 md:py-7">
            {#if app.appIcon}
                <img src={app.appIcon} alt="" class="h-[52px] w-[52px] shrink-0 rounded-[16px] object-cover" />
            {:else}
                <div class="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] bg-[#232323] text-[22px] font-black text-white/80">
                    {app.appName[0]?.toUpperCase() ?? "?"}
                </div>
            {/if}

            <h2 class="m-0 mt-5 flex max-w-full items-center gap-2 text-[20px] font-extrabold leading-[1.1] text-white md:text-[24px]">
                <span class="truncate">{app.appName}</span>
                {#if app.encrypted}
                    <Lock class="h-4 w-4 shrink-0 text-[#32A94C]" size={16} strokeWidth={2.5} aria-label="End-to-end encrypted" />
                {/if}
            </h2>

            <p class="m-0 mt-3 max-w-full truncate text-[14px] leading-5 text-[#B9BBBE] md:text-[16px]">
                {identityLabel ? `As ${identityLabel}` : websiteHost || "Connected app"}
            </p>

            <p class="m-0 mt-2 max-w-full truncate text-[13px] leading-5 text-[#666666] tabular-nums md:text-[14px]">
                Last used: {formatLastUsed(app.lastAuthorizedAt)}
            </p>
        </div>
    {/if}

    <button
        class="flex min-h-[54px] w-full items-center justify-center bg-[#1d1d1d] px-4 text-[13px] font-black text-[#FF5454] transition-[background-color,scale] duration-300 hover:bg-[#232323] active:scale-[0.96] disabled:cursor-not-allowed md:text-[15px]"
        onclick={() => (confirming ? onRevoke(app.id) : (confirming = true))}
        disabled={revoking}
        aria-label={confirming ? `Disconnect ${app.appName}` : `Remove ${app.appName}`}
    >
        {#if revoking}
            <div class="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
        {:else if confirming}
            Disconnect
        {:else}
            <X class="h-7 w-7" size={28} strokeWidth={1.25} />
        {/if}
    </button>
</div>
