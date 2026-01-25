<script>
  import Modal from "./Modal.svelte";
  import { store } from "../../lib/store.svelte.js";
  import { trySheetAuth } from "../../lib/auth.js";
  
  let { onclose } = $props();
  
  function signInAndClose() {
    onclose();
    trySheetAuth();
  }
</script>

<Modal title="E2EE Notes Demo" {onclose}>
  {#if !store.user}
    <div class="text-center py-12">
      <div class="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#222] flex items-center justify-center mx-auto mb-6">
        <svg class="w-8 h-8 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="5" y="11" width="14" height="10" rx="2" stroke-width="1.5"/>
          <path d="M8 11V7a4 4 0 118 0v4" stroke-width="1.5"/>
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-white mb-2">Sign in to try E2EE Notes</h3>
      <p class="text-[#666] mb-6">Your notes will be encrypted with keys only you control.</p>
      <button 
        onclick={signInAndClose}
        class="px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-[#eee] transition-colors"
      >
        Sign in with Ave
      </button>
    </div>
  {:else}
    <div class="space-y-4">
      <div class="p-4 bg-[#0a0a0a] rounded-2xl border border-[#1a1a1a]">
        <div class="flex items-center gap-2 mb-3">
          <svg class="w-4 h-4 text-[#32a94c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2"/>
          </svg>
          <span class="text-xs text-[#32a94c]">End-to-end encrypted</span>
        </div>
        <textarea 
          placeholder="Write a private note..."
          class="w-full bg-transparent text-white placeholder:text-[#444] resize-none focus:outline-none text-sm leading-relaxed"
          rows="4"
        ></textarea>
      </div>
      <p class="text-xs text-[#555] text-center">
        This note would be encrypted with your Ave encryption key. 
        Even Ave servers can't read it.
      </p>
    </div>
  {/if}
</Modal>
