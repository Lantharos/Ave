<script>
  import { store } from "../lib/store.svelte.js";
</script>

<header class="relative z-10 border-b border-[#1a1a1a]">
  <div class="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <span class="text-white font-bold text-sm">A</span>
      </div>
      <span class="text-[#b9bbbe] text-lg font-medium">Ave Playground</span>
    </div>
    
    <div class="flex items-center gap-4">
      {#if store.user}
        <div class="flex items-center gap-3 px-4 py-2 bg-[#171717] rounded-full">
          <div class="w-6 h-6 rounded-full bg-[#333] flex items-center justify-center text-xs text-[#888]">
            {store.user.user?.displayName?.[0] || "?"}
          </div>
          <span class="text-sm text-[#b9bbbe]">{store.user.user?.displayName || "Signed in"}</span>
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
