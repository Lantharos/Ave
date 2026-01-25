<script>
  import Modal from "./Modal.svelte";
  import { store } from "../../lib/store.svelte.js";
  import { trySheetAuth, trySigningDemo } from "../../lib/auth.js";
  
  let { onclose } = $props();
  
  function signInAndClose() {
    onclose();
    trySheetAuth();
  }
</script>

<Modal title="Ave Signing Demo" {onclose}>
  {#if !store.user}
    <div class="text-center py-12">
      <div class="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#222] flex items-center justify-center mx-auto mb-6">
        <svg class="w-8 h-8 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-width="1.5"/>
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-white mb-2">Sign in to try Signing</h3>
      <p class="text-[#666] mb-6">Cryptographically sign messages with your Ave identity.</p>
      <button 
        onclick={signInAndClose}
        class="px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-[#eee] transition-colors"
      >
        Sign in with Ave
      </button>
    </div>
  {:else}
    <div class="space-y-6">
      <div>
        <span class="block text-sm text-[#888] mb-2">Message to sign</span>
        <div class="p-4 bg-[#0a0a0a] rounded-2xl border border-[#1a1a1a] mono text-sm text-[#ccc]">
          I agree to the Terms of Service v2.0 for Demo App
        </div>
      </div>
      
      <button 
        onclick={trySigningDemo}
        class="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-[#eee] transition-colors flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-width="1.5"/>
        </svg>
        Sign Message
      </button>
      
      {#if store.signResult}
        <div class="p-4 bg-[#0a0a0a] rounded-2xl border border-[#1a1a1a]">
          {#if store.signResult.denied}
            <p class="text-[#e14747] text-sm">Signature request was denied.</p>
          {:else}
            <p class="text-[#32a94c] text-sm mb-2">Signature created!</p>
            <p class="text-[#555] text-xs mono break-all">{store.signResult.signature?.slice(0, 64)}...</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</Modal>
