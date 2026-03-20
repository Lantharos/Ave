<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
  import type { DevApp } from "../lib/api";
  import { formatDate } from "../lib/portal";

  interface Props {
    apps: DevApp[];
    loading: boolean;
    oncreate: () => void;
    onselect: (app: DevApp) => void;
  }

  let { apps, loading, oncreate, onselect }: Props = $props();

  let search = $state("");

  const filtered = $derived(
    search.trim()
      ? apps.filter((app) =>
          [app.name, app.clientId, app.description || ""].some((value) =>
            value.toLowerCase().includes(search.trim().toLowerCase()),
          ),
        )
      : apps,
  );

  const overview = $derived({
    total: apps.length,
    resources: apps.reduce((count, app) => count + (app.resources?.length || 0), 0),
    secure: apps.filter((app) => app.supportsE2ee).length,
  });
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="flex flex-col gap-3">
      <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Applications</h1>
      <p class="m-0 max-w-[700px] text-[15px] md:text-[18px] font-medium text-[#7e7e7e]">
        Keep Ave feeling operational. Every app should read like a product surface with health, auth posture, and identity context close at hand.
      </p>
    </div>
    <Button variant="primary" size="sm" onclick={oncreate}>Create application</Button>
  </div>

  <div class="grid gap-3 md:grid-cols-3">
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Applications</span>
        <span class="text-[34px] font-black text-white">{overview.total}</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Connector resources</span>
        <span class="text-[34px] font-black text-white">{overview.resources}</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">E2EE ready apps</span>
        <span class="text-[34px] font-black text-white">{overview.secure}</span>
      </div>
    </Card>
  </div>

  {#if loading}
    <Card>
      <div class="flex items-center gap-4 py-10">
        <div class="h-6 w-6 rounded-full border-2 border-white/10 border-t-white/60 animate-spin"></div>
        <span class="text-[16px] text-[#7d7d7d]">Loading applications</span>
      </div>
    </Card>
  {:else}
    <div class="flex items-center gap-3 flex-wrap">
      <div class="relative min-w-[260px] flex-1">
        <svg class="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          class="w-full rounded-full border-0 bg-white/[0.04] px-5 py-3 pl-12 text-[15px] text-white outline-none ring-0 placeholder:text-[#555] focus:bg-white/[0.06]"
          bind:value={search}
          placeholder="Search applications"
        />
      </div>
      <div class="rounded-full bg-white/[0.04] px-4 py-3 text-[13px] text-[#7d7d7d]">
        {filtered.length} shown
      </div>
    </div>

    {#if filtered.length === 0}
      <Card>
        <div class="flex flex-col items-center gap-4 py-16 text-center">
          <p class="m-0 text-[22px] font-semibold text-white">Nothing matches yet</p>
          <p class="m-0 max-w-[420px] text-[15px] text-[#7d7d7d]">Try another search term or create a new application to start building the workspace out.</p>
        </div>
      </Card>
    {:else}
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <button
          class="min-h-[280px] rounded-[28px] border-0 border-dashed bg-white/[0.03] p-0 text-left cursor-pointer transition-colors duration-300 hover:bg-white/[0.05]"
          onclick={oncreate}
        >
          <div class="flex h-full flex-col items-center justify-center gap-4 rounded-[28px] px-8 py-10 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
            <div class="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.05] text-white">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div class="flex flex-col gap-2">
              <p class="m-0 text-[20px] font-semibold text-white">Create application</p>
              <p class="m-0 text-[14px] text-[#7d7d7d]">Spin up a new Ave integration and start tuning auth behavior from a proper dashboard.</p>
            </div>
          </div>
        </button>

        {#each filtered as app}
          <button
            class="rounded-[28px] border-0 bg-transparent p-0 text-left cursor-pointer"
            onclick={() => onselect(app)}
          >
            <Card>
              <div class="flex h-full flex-col gap-6">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white/[0.05] shrink-0">
                      {#if app.iconUrl}
                        <img src={app.iconUrl} alt="" class="h-7 w-7 rounded-[10px]" />
                      {:else}
                        <svg class="h-5 w-5 text-[#808080]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      {/if}
                    </div>
                    <div class="min-w-0">
                      <p class="m-0 truncate text-[20px] font-semibold text-white">{app.name}</p>
                      <p class="m-0 mt-1 truncate text-[13px] text-[#7d7d7d]">{app.clientId}</p>
                    </div>
                  </div>
                  <span class="rounded-full bg-white/[0.04] px-3 py-1.5 text-[12px] text-[#9a9a9a]">
                    {app.supportsE2ee ? "E2EE ready" : "Standard"}
                  </span>
                </div>

                <p class="m-0 min-h-[44px] text-[14px] leading-6 text-[#8b8b8b]">
                  {app.description || "No description yet. Open the control panel to add metadata, redirect coverage, and resource policy."}
                </p>

                <div class="grid grid-cols-2 gap-3">
                  <div class="rounded-[20px] bg-white/[0.03] px-4 py-4">
                    <p class="m-0 text-[12px] text-[#686868]">Redirects</p>
                    <p class="m-0 mt-2 text-[20px] font-semibold text-white">{app.redirectUris.length}</p>
                  </div>
                  <div class="rounded-[20px] bg-white/[0.03] px-4 py-4">
                    <p class="m-0 text-[12px] text-[#686868]">Resources</p>
                    <p class="m-0 mt-2 text-[20px] font-semibold text-white">{app.resources?.length || 0}</p>
                  </div>
                </div>

                <div class="mt-auto flex items-center justify-between gap-3">
                  <span class="text-[13px] text-[#6d6d6d]">Created {formatDate(app.createdAt)}</span>
                  <span class="text-[14px] font-medium text-[#b9bbbe]">Open dashboard</span>
                </div>
              </div>
            </Card>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>
