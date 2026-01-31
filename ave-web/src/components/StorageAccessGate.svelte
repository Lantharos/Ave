<script lang="ts">
    import Text from "./Text.svelte";

    export let title: string;
    export let message: string;
    export let cta: string;
    export let busy: boolean = false;
    export let onclick: () => void;
</script>

<div class="bg-[#090909] min-h-screen-fixed flex items-center justify-center p-6 md:p-[50px]">
    <div class="w-full max-w-[520px] bg-[#111111]/70 border border-[#222222] rounded-[24px] p-6 md:p-[36px] backdrop-blur-xl">
        <div class="flex flex-col gap-3">
            <Text type="h" size={24} color="#FFFFFF">{title}</Text>
            <Text type="p" size={16} color="#878787">{message}</Text>
        </div>

        <button
            class="mt-6 w-full py-[16px] rounded-[16px] bg-[#FFFFFF] text-[#090909] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            onclick={onclick}
            disabled={busy}
        >
            {#if busy}
                <span class="inline-flex items-center justify-center gap-3">
                    <span class="w-5 h-5 border-2 border-[#090909] border-t-transparent rounded-full animate-spin"></span>
                    <span>Checking…</span>
                </span>
            {:else}
                {cta}
            {/if}
        </button>
    </div>
</div>
