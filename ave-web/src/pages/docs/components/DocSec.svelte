<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import type { Snippet } from "svelte";

    let { title, id = "", children }: { title: string; id?: string; children: Snippet } = $props();
</script>

<section class="flex flex-col gap-[15px] w-full scroll-mt-[120px]" id={id}>
    <div class="flex flex-col gap-[8px]">
        <Text type="h" size={36} weight="bold" color="#FFFFFF">{title}</Text>
        <div class="h-[2px] bg-gradient-to-r from-[#333333] to-transparent w-full"></div>
    </div>
    <div class="text-[#a0a0a0] text-[17px] font-normal leading-[1.8] doc-content mt-[10px]">
        {@render children()}
    </div>
</section>

<style>
    :global(.doc-content > p code),
    :global(.doc-content > ul code),
    :global(.doc-content > div:not(.code-block-wrapper) code),
    :global(.doc-content td code) {
        background: #1f1f1f;
        color: #e8e8e8;
        padding: 3px 8px;
        border-radius: 6px;
        font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        font-size: 15px;
        border: 1px solid #2a2a2a;
    }
    
    :global(.doc-content a) {
        color: #B9BBBE;
        text-decoration: underline;
        text-underline-offset: 3px;
        transition: color 0.2s;
    }
    
    :global(.doc-content a:hover) {
        color: #ffffff;
    }

    :global(.doc-content ul) {
        margin-left: 0;
    }

    :global(.doc-content li) {
        margin-bottom: 8px;
    }
</style>
