<script>
  import IconWindow from "./icons/IconWindow.svelte";
  import IconSheet from "./icons/IconSheet.svelte";
  import IconLock from "./icons/IconLock.svelte";
  import IconPen from "./icons/IconPen.svelte";
  
  let { title, description, icon, onclick } = $props();
  
  const iconComponents = {
    window: IconWindow,
    sheet: IconSheet,
    lock: IconLock,
    pen: IconPen
  };
  
  // Get the icon component dynamically
  const IconComponent = $derived(iconComponents[icon]);
</script>

<button
  {onclick}
  class="group relative p-8 bg-[#111111] border border-[#1a1a1a] rounded-3xl text-left transition-all duration-300 hover:border-[#333] hover:bg-[#151515] hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
>
  <!-- Icon -->
  <div class="w-14 h-14 rounded-2xl bg-[#1a1a1a] border border-[#222] flex items-center justify-center mb-5 group-hover:border-[#333] transition-colors">
    <IconComponent />
  </div>
  
  <h3 class="text-xl font-semibold text-white mb-2">{title}</h3>
  <p class="text-[#666] leading-relaxed">{description}</p>
  
  <!-- Arrow indicator -->
  <div class="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
    <svg class="w-5 h-5 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M7 17L17 7M17 7H7M17 7v10" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
</button>
