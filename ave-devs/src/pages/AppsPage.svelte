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
    rotatingAppId: string | null;
    rotatedAppId: string | null;
  }

  let { apps, loading, oncreate, onselect, onrotate, rotatingAppId, rotatedAppId }: Props = $props();

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
    <div class="flex flex-col gap-4">
      {#each apps as app}
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
              <Button
                variant="outline"
                size="sm"
                onclick={() => onrotate(app.id)}
                disabled={rotatingAppId === app.id}
              >
                {rotatingAppId === app.id ? "Rotating..." : rotatedAppId === app.id ? "Rotated" : "Rotate secret"}
              </Button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
</div>
