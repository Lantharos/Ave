<script>
  import { openAveSigningSheet } from "@ave-id/embed";
  import Modal from "./Modal.svelte";
  import { store } from "../../lib/store.svelte.js";
  import { trySheetAuth } from "../../lib/auth.js";
  
  let { onclose } = $props();
  
  let message = $state("I confirm this action on Ave Playground");
  let loading = $state(false);
  let error = $state(null);
  let result = $state(null);
  
  function signInAndClose() {
    onclose();
    trySheetAuth();
  }
  
  async function createAndSign() {
    loading = true;
    error = null;
    result = null;
    
    try {
      // We need to get the user's identity ID - for now use the one from the auth
      // In a real implementation, you'd let user pick which identity to sign with
      const identityId = store.user?.identityId;
      
      if (!identityId) {
        // For demo, we need to get identity from the session
        // Let's fetch it from the API
        const meRes = await fetch("https://aveid.net/api/auth/me", {
          credentials: "include"
        });
        
        if (!meRes.ok) {
          throw new Error("Not authenticated with Ave");
        }
        
        const meData = await meRes.json();
        const identity = meData.currentIdentity || meData.identities?.[0];
        
        if (!identity) {
          throw new Error("No identity found");
        }
        
        store.user = { ...store.user, identityId: identity.id };
      }
      
      // Create demo signature request
      const createRes = await fetch("https://aveid.net/api/signing/demo/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          identityId: store.user.identityId,
          payload: message,
        }),
      });
      
      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Failed to create request");
      }
      
      const { requestId } = await createRes.json();
      
      // Open signing sheet
      openAveSigningSheet({
        requestId,
        onSigned: (data) => {
          result = { signed: true, signature: data.signature };
          loading = false;
        },
        onDenied: () => {
          result = { denied: true };
          loading = false;
        },
        onClose: () => {
          loading = false;
        },
      });
      
    } catch (err) {
      error = err.message;
      loading = false;
    }
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
        <label for="message" class="block text-sm text-[#888] mb-2">Message to sign</label>
        <textarea
          id="message"
          bind:value={message}
          rows="3"
          class="w-full p-4 bg-[#0a0a0a] rounded-2xl border border-[#1a1a1a] text-white text-sm resize-none focus:outline-none focus:border-[#333]"
          placeholder="Enter a message to sign..."
        ></textarea>
      </div>
      
      {#if error}
        <div class="p-4 bg-[#1a0a0a] rounded-2xl border border-[#2a1a1a] text-[#e14747] text-sm">
          {error}
        </div>
      {/if}
      
      {#if result}
        <div class="p-4 bg-[#0a0a0a] rounded-2xl border border-[#1a1a1a]">
          {#if result.denied}
            <p class="text-[#e14747] text-sm">Signature request was denied.</p>
          {:else if result.signed}
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-4 h-4 text-[#32a94c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <p class="text-[#32a94c] text-sm font-medium">Signature created!</p>
            </div>
            <p class="text-[#555] text-xs font-mono break-all">{result.signature}</p>
          {/if}
        </div>
      {/if}
      
      <button 
        onclick={createAndSign}
        disabled={loading || !message.trim()}
        class="w-full py-4 bg-white text-black font-medium rounded-xl hover:bg-[#eee] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if loading}
          <div class="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
        {:else}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-width="1.5"/>
          </svg>
        {/if}
        Sign Message
      </button>
    </div>
  {/if}
</Modal>

<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>
