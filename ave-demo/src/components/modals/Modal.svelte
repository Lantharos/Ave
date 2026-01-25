<script>
  let { title, onclose, children } = $props();
</script>

<div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
  <div class="bg-[#111111] border border-[#222] rounded-3xl w-full max-w-2xl overflow-hidden animate-in">
    <div class="border-b border-[#222] px-6 py-4 flex items-center justify-between">
      <h2 class="text-lg font-semibold text-white">{title}</h2>
      <button onclick={onclose} class="text-[#666] hover:text-white transition-colors" aria-label="Close modal">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    
    <div class="p-6">
      {@render children()}
    </div>
  </div>
</div>

<style>
  @keyframes animate-in {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  .animate-in {
    animation: animate-in 0.2s ease-out;
  }
</style>
