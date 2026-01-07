<script lang="ts">
    let { code, language = "javascript" }: { code: string; language?: string } = $props();
    
    let copied = $state(false);
    
    function copyCode() {
        navigator.clipboard.writeText(code);
        copied = true;
        setTimeout(() => copied = false, 2000);
    }
</script>

<div class="code-block-wrapper relative group my-[20px]">
    <div class="absolute top-[12px] right-[12px] z-10">
        <button 
            class="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-[#999999] hover:text-[#ffffff] text-[13px] px-[14px] py-[7px] rounded-[8px] transition-all duration-200 flex items-center gap-[6px]"
            onclick={copyCode}
        >
            {#if copied}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Copied
            {:else}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
            {/if}
        </button>
    </div>
    <pre class="bg-[#0a0a0a] border border-[#1a1a1a] rounded-[12px] p-[24px] pr-[100px] overflow-x-auto text-[14px] leading-[1.7]"><code class="text-[#d4d4d4] font-mono">{code}</code></pre>
</div>

<style>
    pre {
        font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        tab-size: 2;
    }
    
    pre code {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
    }
</style>
