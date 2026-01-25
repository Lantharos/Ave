<script>
  import { store } from "../lib/store.svelte.js";
</script>

<header class="relative z-10 border-b border-[#1a1a1a]">
  <div class="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <span class="text-[#b9bbbe] text-lg font-medium">Ave Playground</span>
    </div>
    
    <div class="flex items-center gap-4">
      {#if store.user}
        <div class="flex items-center gap-3 px-4 py-2 bg-[#171717] rounded-full">
          <div class="w-2 h-2 rounded-full bg-[#32a94c]"></div>
          <span class="text-sm text-[#b9bbbe]">Authenticated via {store.user.method}</span>
          <button onclick={() => store.logout()} class="text-xs text-[#666] hover:text-[#999] transition-colors">
            logout
          </button>
        </div>
      {/if}
      <a 
        href="https://devs.aveid.net" 
        target="_blank"
        class="text-sm text-[#666] hover:text-[#999] transition-colors"
      >
        Developer Portal
      </a>
    </div>
  </div>
</header>
