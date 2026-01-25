<script>
  import { onMount } from "svelte";
  import { store } from "../lib/store.svelte.js";
  
  let status = $state("processing");
  let error = $state(null);
  
  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");
    const errorDescription = params.get("error_description");
    
    if (errorParam) {
      status = "error";
      error = errorDescription || errorParam;
      return;
    }
    
    if (!code) {
      status = "error";
      error = "No authorization code received";
      return;
    }
    
    // In a real app, you'd exchange the code for tokens server-side
    // For the demo, we'll simulate success
    status = "success";
    
    // If opened as popup, send message to parent and close
    if (window.opener) {
      window.opener.postMessage({
        type: "ave-auth-callback",
        code,
        state: params.get("state")
      }, "*");
      setTimeout(() => window.close(), 1000);
    }
  });
</script>

<div class="min-h-screen bg-[#090909] flex items-center justify-center p-6">
  <div class="bg-[#111111] border border-[#1a1a1a] rounded-3xl p-8 max-w-md w-full text-center">
    {#if status === "processing"}
      <div class="w-12 h-12 rounded-full border-2 border-[#333] border-t-white animate-spin mx-auto mb-6"></div>
      <h2 class="text-xl font-semibold text-white mb-2">Processing...</h2>
      <p class="text-[#666]">Completing authentication</p>
    {:else if status === "success"}
      <div class="w-16 h-16 rounded-full bg-[#32a94c]/10 flex items-center justify-center mx-auto mb-6">
        <svg class="w-8 h-8 text-[#32a94c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M5 13l4 4L19 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-white mb-2">Success!</h2>
      <p class="text-[#666] mb-6">You've been authenticated with Ave.</p>
      <a 
        href="/"
        class="inline-block px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-[#eee] transition-colors"
      >
        Back to Playground
      </a>
    {:else if status === "error"}
      <div class="w-16 h-16 rounded-full bg-[#e14747]/10 flex items-center justify-center mx-auto mb-6">
        <svg class="w-8 h-8 text-[#e14747]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-white mb-2">Authentication Failed</h2>
      <p class="text-[#666] mb-6">{error}</p>
      <a 
        href="/"
        class="inline-block px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-[#eee] transition-colors"
      >
        Try Again
      </a>
    {/if}
  </div>
</div>

<style>
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>
