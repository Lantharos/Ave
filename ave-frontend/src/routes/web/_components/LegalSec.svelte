<script lang="ts">
    import type { Snippet } from "svelte";
    import Text from "$lib/surfaces/web/components/Text.svelte";

    let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<div class="flex flex-col gap-[5px] w-full">
    <Text type="h" size={48} weight="semibold" color="#B9BBBE">{title}</Text>
    <div class="h-[1px] bg-[#B9BBBE] w-full"></div>
    <Text type="p" size={18} weight="normal" cclass="text-[#878787] whitespace-pre-line">
        {@render children?.()}
    </Text>
</div>
