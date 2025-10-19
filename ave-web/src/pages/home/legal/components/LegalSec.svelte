<script lang="ts">
    import Text from "../../../../components/Text.svelte";

    export let title: string;
</script>

<div class="flex flex-col gap-[5px] w-full">
    <Text type="h" size={48} weight="medium" color="#B9BBBE">{title}</Text>
    <div class="h-[1px] bg-[#B9BBBE] w-full"></div>
    <Text type="p" size={18} weight="normal" cclass="text-[#878787] whitespace-pre-line">
        <slot />
    </Text>
</div>