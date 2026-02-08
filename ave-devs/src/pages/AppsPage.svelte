<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
  import type { DevApp } from "../lib/api";

  interface Props {
    apps: DevApp[];
    loading: boolean;
    oncreate: () => void;
    onselect: (app: DevApp) => void;
    onrotate: (appId: string) => void;
  }

  let { apps, loading, oncreate, onselect, onrotate }: Props = $props();

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
</script>

<div class="flex flex-col gap-6">
  <div class="flex justify-between items-start gap-4 flex-wrap">
    <div>
      <h2 class="text-xl font-semibold m-0 mb-1">Your apps</h2>
      <p class="text-[14px] text-[#888] m-0">Manage apps tied to your Ave account.</p>
    </div>
    <Button variant="primary" size="sm" onclick={oncreate}>Create new app</Button>
  </div>

  {#if loading}
    <Card>
      <div class="flex items-center gap-3 py-4">
        <div class="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"></div>
        <span class="text-[14px] text-[#888]">Loading apps...</span>
      </div>
    </Card>
  {:else if apps.length === 0}
    <Card>
      <div class="flex flex-col items-center justify-center py-12 gap-4">
        <div class="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center">
          <svg class="w-7 h-7 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div class="text-center">
          <p class="text-[15px] text-[#999] m-0 mb-1">No apps yet</p>
          <p class="text-[13px] text-[#666] m-0">Create your first app to get started.</p>
        </div>
        <Button variant="primary" size="sm" onclick={oncreate}>Create app</Button>
      </div>
    </Card>
  {:else}
    <div class="flex flex-col gap-3">
      {#each apps as app}
        <Card>
          <div class="flex justify-between items-start gap-4 flex-wrap">
            <div class="flex items-start gap-3.5 min-w-0 flex-1">
              <div class="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                {#if app.iconUrl}
                  <img src={app.iconUrl} alt="" class="w-6 h-6 rounded" />
                {:else}
                  <svg class="w-5 h-5 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                {/if}
              </div>
              <div class="min-w-0">
                <h3 class="text-[15px] font-semibold m-0 mb-1">{app.name}</h3>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span class="text-[12px] text-[#666] font-mono">{app.clientId}</span>
                  <span class="text-[12px] text-[#555]">{app.redirectUris.length} redirect{app.redirectUris.length !== 1 ? "s" : ""}</span>
                  {#if app.supportsE2ee}
                    <span class="text-[11px] text-[#32a94c] bg-[#32a94c]/10 px-2 py-0.5 rounded-full font-medium">E2EE</span>
                  {/if}
                  <span class="text-[12px] text-[#555]">{formatDate(app.createdAt)}</span>
                </div>
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <Button variant="ghost" size="sm" onclick={() => onselect(app)}>Manage</Button>
              <Button variant="outline" size="sm" onclick={() => onrotate(app.id)}>Rotate secret</Button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>
