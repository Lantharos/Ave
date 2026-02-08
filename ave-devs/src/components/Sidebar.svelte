<script lang="ts">
  import Button from "./Button.svelte";

  type View = "overview" | "apps" | "create" | "activity" | "settings" | "app";

  interface Props {
    activeView: View;
    authenticated: boolean;
    onnavigate: (view: View) => void;
    onsignin: () => void;
    onsignout: () => void;
  }

  let { activeView, authenticated, onnavigate, onsignin, onsignout }: Props = $props();

  const navItems: { view: View; label: string; icon: string }[] = [
    { view: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { view: "apps", label: "Apps", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { view: "create", label: "Create app", icon: "M12 4v16m8-8H4" },
    { view: "activity", label: "Activity", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
    { view: "settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  ];
</script>

<aside class="h-screen sticky top-0 w-[240px] flex flex-col py-7 px-5 bg-[#0c0c0c] border-r border-white/[0.04] max-[900px]:relative max-[900px]:h-auto max-[900px]:w-full max-[900px]:flex-row max-[900px]:items-center max-[900px]:justify-between max-[900px]:py-4 max-[900px]:border-b max-[900px]:border-r-0">
  <div class="flex items-center gap-3 mb-2">
    <img src="/icon.png" alt="Ave" class="w-7 h-7" />
    <span class="text-[15px] font-semibold tracking-tight text-white/80">Developers</span>
  </div>

  {#if authenticated}
    <nav class="flex flex-col gap-1 mt-6 max-[900px]:flex-row max-[900px]:gap-1.5 max-[900px]:mt-0 max-[900px]:flex-wrap">
      {#each navItems as item}
        <button
          class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[13px] font-medium cursor-pointer border-0 transition-all duration-200
            {activeView === item.view
            ? 'bg-white/[0.08] text-white'
            : 'bg-transparent text-[#888] hover:text-[#ccc] hover:bg-white/[0.04]'}"
          onclick={() => onnavigate(item.view)}
        >
          <svg class="w-4 h-4 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
          </svg>
          <span class="max-[900px]:hidden max-[600px]:inline">{item.label}</span>
        </button>
      {/each}
    </nav>

    <div class="mt-auto max-[900px]:mt-0">
      <Button variant="ghost" size="sm" onclick={onsignout}>Sign out</Button>
    </div>
  {:else}
    <div class="mt-auto flex justify-center max-[900px]:mt-0">
      <Button variant="primary" size="sm" onclick={onsignin}>Sign in</Button>
    </div>
  {/if}
</aside>
