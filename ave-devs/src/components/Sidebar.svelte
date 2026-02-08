<script lang="ts">
  type View = "overview" | "apps" | "create" | "app";

  interface Props {
    activeView: View;
    onnavigate: (view: View) => void;
    onsignout: () => void;
  }

  let { activeView, onnavigate, onsignout }: Props = $props();

  const navItems: { view: View; label: string }[] = [
    { view: "overview", label: "Overview" },
    { view: "apps", label: "Apps" },
    { view: "create", label: "Create App" },
  ];

</script>

<div class="flex flex-col gap-[40px] w-[20%] z-10 max-md:hidden">
  <div class="flex flex-col gap-[10px]">
    <span class="text-[24px] font-black text-[#878787]">APPS</span>
    {#each navItems as item}
      <button
        class="w-full px-[25px] py-[15px] rounded-full flex items-center text-[24px] font-medium border-0 cursor-pointer transition-colors duration-300
          {activeView === item.view
          ? 'bg-[#B9BBBE]/20 text-[#A8A8A8]'
          : 'bg-transparent text-[#878787] hover:bg-[#202020]'}"
        onclick={() => onnavigate(item.view)}
      >
        {item.label}
      </button>
    {/each}
  </div>

  <div class="h-px bg-[#878787]/20 w-full"></div>

  <button
    class="w-full px-[25px] py-[15px] rounded-full flex items-center text-[24px] font-medium border-0 cursor-pointer transition-colors duration-300 bg-transparent text-[#878787] hover:bg-[#202020]"
    onclick={onsignout}
  >
    Sign Out
  </button>
</div>

<button
  aria-label="Open navigation menu"
  class="fixed top-3 right-3 z-50 p-2 bg-[#171717] rounded-full md:hidden border-0 cursor-pointer"
  onclick={() => {
    const el = document.getElementById("mobile-nav");
    if (el) el.classList.toggle("hidden");
  }}
>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B9BBBE" stroke-width="2">
    <path d="M3 12h18M3 6h18M3 18h18"/>
  </svg>
</button>

<div id="mobile-nav" class="hidden fixed inset-0 z-40 bg-[#090909] p-6 pt-16 overflow-auto md:hidden">
  <div class="flex flex-col gap-4">
    <span class="text-[14px] font-black text-[#878787]">APPS</span>
    {#each navItems as item}
      <button
        class="w-full px-4 py-2 rounded-full flex items-center text-[16px] font-medium border-0 cursor-pointer transition-colors duration-300
          {activeView === item.view
          ? 'bg-[#B9BBBE]/20 text-[#A8A8A8]'
          : 'bg-transparent text-[#878787] hover:bg-[#202020]'}"
        onclick={() => {
          onnavigate(item.view);
          document.getElementById("mobile-nav")?.classList.add("hidden");
        }}
      >
        {item.label}
      </button>
    {/each}

    <div class="h-px bg-[#878787]/20 w-full my-1"></div>

    <button
      class="w-full px-4 py-2 rounded-full flex items-center text-[16px] font-medium border-0 cursor-pointer transition-colors duration-300 bg-transparent text-[#878787] hover:bg-[#202020]"
      onclick={() => {
        onsignout();
        document.getElementById("mobile-nav")?.classList.add("hidden");
      }}
    >
      Sign Out
    </button>
  </div>
</div>
