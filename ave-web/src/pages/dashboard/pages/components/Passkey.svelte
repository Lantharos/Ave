<script lang="ts">
    import Text from "../../../../components/Text.svelte";
    import type { Passkey as PasskeyType } from "../../../../lib/api";

    interface Props {
        passkey: PasskeyType;
        onDelete?: (id: string) => void;
        deleting?: boolean;
    }

    let { passkey, onDelete, deleting = false }: Props = $props();

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }
</script>

<div class="flex flex-row gap-[10px] w-full">
    <div class="flex flex-col justify-center items-start px-[20px] py-[15px] bg-[#111111] rounded-[24px] flex-grow">
        <Text type="h" size={20} color="#B9BBBE" weight="bold">{passkey.name || "Unnamed Passkey"}</Text>
        <Text type="p" size={14} color="#666666">Added {formatDate(passkey.createdAt)}{passkey.lastUsedAt ? ` · Last used ${formatDate(passkey.lastUsedAt)}` : ""}</Text>
    </div>
    <button 
        aria-label="delete" 
        class="flex flex-row justify-center items-center px-[20px] py-[15px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[24px] min-h-full w-fit disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={() => onDelete?.(passkey.id)}
        disabled={deleting}
    >
        {#if deleting}
            <div class="w-[24px] h-[24px] border-2 border-[#E14747] border-t-transparent rounded-full animate-spin"></div>
        {:else}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 11V17M14 11V17M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M3 6H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        {/if}
    </button>
</div>