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
          {#if store.user.userInfo?.picture}
            <img src={store.user.userInfo.picture} alt="" class="w-6 h-6 rounded-full" />
          {:else}
            <div class="w-6 h-6 rounded-full bg-[#333] flex items-center justify-center text-xs text-[#888]">
              {store.user.userInfo?.name?.[0] || "?"}
            </div>
          {/if}
          <span class="text-sm text-[#b9bbbe]">{store.user.userInfo?.name || store.user.userInfo?.preferred_username || "Signed in"}</span>
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
