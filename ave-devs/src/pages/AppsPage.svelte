<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
  import type { DevApp } from "../lib/api";

  interface Props {
    apps: DevApp[];
    loading: boolean;
    oncreate: () => void;
    onselect: (app: DevApp) => void;
  }

  let { apps, loading, oncreate, onselect }: Props = $props();

  let search = $state("");
  let viewMode: "list" | "grid" = $state(
    (localStorage.getItem("ave_devs_view") as "list" | "grid") || "list",
  );

  function setViewMode(mode: "list" | "grid") {
    viewMode = mode;
    localStorage.setItem("ave_devs_view", mode);
  }

  const filtered = $derived(
    search.trim()
      ? apps.filter(
          (app) =>
            app.name.toLowerCase().includes(search.trim().toLowerCase()) ||
            app.clientId.toLowerCase().includes(search.trim().toLowerCase()),
        )
      : apps,
  );

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<div class="flex flex-col gap-10 md:gap-14">
  <div class="flex justify-between items-start gap-4 flex-wrap">
    <div class="flex flex-col gap-3">
      <h2 class="text-[28px] md:text-[40px] font-black m-0 tracking-tight text-white">Your apps</h2>
      <p class="text-[16px] md:text-[20px] text-[#878787] m-0 font-medium">Manage apps tied to your Ave account.</p>
    </div>
    <Button variant="primary" size="sm" onclick={oncreate}>Create new app</Button>
  </div>

  {#if loading}
    <Card>
      <div class="flex items-center gap-4 py-8">
        <div class="w-6 h-6 border-2 border-[#B9BBBE]/20 border-t-[#B9BBBE]/60 rounded-full animate-spin"></div>
        <span class="text-[16px] md:text-[18px] text-[#878787] font-medium">Loading apps...</span>
      </div>
    </Card>
  {:else if apps.length === 0}
    <Card>
      <div class="flex flex-col items-center justify-center py-16 md:py-20 gap-6">
        <div class="flex flex-col items-center gap-4 text-center">
          <p class="text-[18px] md:text-[24px] text-[#878787] m-0 font-black">No apps yet</p>
          <p class="text-[14px] md:text-[16px] text-[#878787] m-0 font-medium">Create your first app to get started.</p>
        </div>
        <Button variant="primary" size="sm" onclick={oncreate}>Create app</Button>
      </div>
    </Card>
  {:else}
    <div class="flex items-center gap-3">
      <div class="flex-1 relative">
        <svg class="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#555] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          class="w-full bg-[#090909]/50 border-0 rounded-full pl-12 pr-5 py-3.5 md:py-4 text-white text-[15px] md:text-[16px] font-[inherit] placeholder:text-[#555] outline-none focus:ring-2 focus:ring-[#B9BBBE] transition-all duration-300"
          placeholder="Search by name or client ID..."
          bind:value={search}
        />
      </div>
      <div class="flex bg-white/[0.04] rounded-full p-1 shrink-0">
        <button
          class="w-10 h-10 rounded-full flex items-center justify-center border-0 cursor-pointer transition-colors duration-300 {viewMode === 'list' ? 'bg-[#B9BBBE]/15 text-white' : 'bg-transparent text-[#555] hover:text-[#878787]'}"
          onclick={() => setViewMode("list")}
          aria-label="List view"
        >
          <svg class="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <button
          class="w-10 h-10 rounded-full flex items-center justify-center border-0 cursor-pointer transition-colors duration-300 {viewMode === 'grid' ? 'bg-[#B9BBBE]/15 text-white' : 'bg-transparent text-[#555] hover:text-[#878787]'}"
          onclick={() => setViewMode("grid")}
          aria-label="Grid view"
        >
          <svg class="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        </button>
      </div>
    </div>

    {#if filtered.length === 0}
      <Card>
        <div class="flex flex-col items-center justify-center py-12 gap-4">
          <p class="text-[16px] md:text-[18px] text-[#878787] m-0 font-medium">No apps match "{search}"</p>
        </div>
      </Card>
    {:else if viewMode === "list"}
      <div class="flex flex-col gap-4">
        {#each filtered as app}
          <Card>
            <div class="flex justify-between items-start gap-4 flex-wrap">
              <div class="flex items-start gap-4 min-w-0 flex-1">
                <div class="w-12 h-12 md:w-14 md:h-14 rounded-[16px] bg-white/[0.06] flex items-center justify-center shrink-0">
                  {#if app.iconUrl}
                    <img src={app.iconUrl} alt="" class="w-7 h-7 md:w-8 md:h-8 rounded-lg" />
                  {:else}
                    <svg class="w-6 h-6 md:w-7 md:h-7 text-[#878787]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  {/if}
                </div>
                <div class="min-w-0 flex flex-col gap-2">
                  <h3 class="text-[18px] md:text-[20px] font-black m-0 text-white">{app.name}</h3>
                  <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span class="text-[13px] md:text-[14px] text-[#878787] font-mono">{app.clientId}</span>
                    <span class="text-[13px] md:text-[14px] text-[#878787]">{app.redirectUris.length} redirect{app.redirectUris.length !== 1 ? "s" : ""}</span>
                    {#if app.supportsE2ee}
                      <span class="text-[12px] md:text-[13px] text-[#32a94c] bg-[#32a94c]/10 px-3 py-1 rounded-full font-medium">E2EE</span>
                    {/if}
                    <span class="text-[13px] md:text-[14px] text-[#878787]">{formatDate(app.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div class="flex gap-3 shrink-0">
                <Button variant="ghost" size="sm" onclick={() => onselect(app)}>Manage</Button>
              </div>
            </div>
          </Card>
        {/each}
      </div>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each filtered as app}
          <button
            class="text-left border-0 bg-transparent p-0 cursor-pointer group"
            onclick={() => onselect(app)}
          >
            <Card>
              <div class="flex flex-col gap-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-[12px] bg-white/[0.06] flex items-center justify-center shrink-0">
                    {#if app.iconUrl}
                      <img src={app.iconUrl} alt="" class="w-6 h-6 rounded-md" />
                    {:else}
                      <svg class="w-5 h-5 text-[#878787]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    {/if}
                  </div>
                  <h3 class="text-[16px] md:text-[18px] font-black m-0 text-white truncate group-hover:text-[#B9BBBE] transition-colors duration-300">{app.name}</h3>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-[12px] md:text-[13px] text-[#878787] font-mono truncate">{app.clientId}</span>
                  <div class="flex items-center gap-3">
                    <span class="text-[12px] md:text-[13px] text-[#878787]">{app.redirectUris.length} redirect{app.redirectUris.length !== 1 ? "s" : ""}</span>
                    {#if app.supportsE2ee}
                      <span class="text-[11px] text-[#32a94c] bg-[#32a94c]/10 px-2 py-0.5 rounded-full font-medium">E2EE</span>
                    {/if}
                  </div>
                  <span class="text-[12px] md:text-[13px] text-[#878787]">{formatDate(app.createdAt)}</span>
                </div>
              </div>
            </Card>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>
