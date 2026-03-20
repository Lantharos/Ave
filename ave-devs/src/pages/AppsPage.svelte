<script lang="ts">
  import Card from "../components/Card.svelte";
  import { Lock } from "lucide-svelte";
  import type { DevApp } from "../lib/api";
  interface Props {
    apps: DevApp[];
    loading: boolean;
    oncreate: () => void;
    onselect: (app: DevApp) => void;
  }

  let { apps, loading, oncreate, onselect }: Props = $props();

  function getWebsiteHost(value?: string) {
    if (!value) return "Not set";

    try {
      return new URL(value).hostname;
    } catch {
      return value;
    }
  }
</script>

<div class="flex flex-col gap-9 md:gap-12">
  <div class="flex flex-col gap-2">
    <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Applications</h1>
    <p class="m-0 max-w-[520px] text-[15px] text-[#7e7e7e]">Manage the apps connected to this workspace.</p>
  </div>

  {#if loading}
    <Card>
      <div class="flex items-center gap-4 py-5">
        <div class="h-6 w-6 rounded-full border-2 border-white/10 border-t-white/60 animate-spin"></div>
        <span class="text-[16px] text-[#7d7d7d]">Loading applications</span>
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
              <p class="m-0 text-[14px] text-[#7d7d7d]">Add a new app to this workspace.</p>
            </div>
          </div>
        </button>

        {#each apps as app}
          <button
            class="rounded-[28px] border-0 bg-transparent p-0 text-left cursor-pointer"
            onclick={() => onselect(app)}
          >
            <Card class="transition-colors duration-300 hover:bg-[#171717]/88">
              <div class="flex h-full flex-col gap-6">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white/[0.05] shrink-0">
                      {#if app.iconUrl}
                        <img src={app.iconUrl} alt="" class="h-7 w-auto max-w-full object-contain" />
                      {:else}
                        <svg class="h-5 w-5 text-[#808080]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      {/if}
                    </div>
                    <div class="min-w-0">
                      <p class="m-0 truncate text-[20px] font-semibold text-white">{app.name}</p>
                    </div>
                  </div>
                  {#if app.supportsE2ee}
                    <span class="flex h-10 w-10 items-center justify-center rounded-full bg-[#17311f] text-[#67d58a] shrink-0">
                      <Lock class="h-4 w-4" stroke-width={2.2} />
                    </span>
                  {/if}
                </div>

                <p class="m-0 min-h-[44px] text-[14px] leading-6 text-[#8b8b8b]">
                  {app.description || "No description yet."}
                </p>

                <div class="grid grid-cols-2 gap-3">
                  <div class="rounded-[20px] bg-white/[0.03] px-4 py-4">
                    <p class="m-0 text-[12px] text-[#686868]">Website</p>
                    <p class="m-0 mt-2 truncate text-[16px] font-semibold text-white">{getWebsiteHost(app.websiteUrl)}</p>
                  </div>
                  <div class="rounded-[20px] bg-white/[0.03] px-4 py-4">
                    <p class="m-0 text-[12px] text-[#686868]">Identities</p>
                    <p class="m-0 mt-2 text-[16px] font-semibold text-white">{app.identityCount || 0}</p>
                  </div>
                </div>

                <div class="mt-auto flex items-center justify-between gap-3">
                  <span class="text-[13px] text-[#6d6d6d]">{app.redirectUris.length} redirects</span>
                  <span class="text-[14px] font-medium text-[#b9bbbe]">Open dashboard</span>
                </div>
              </div>
            </Card>
          </button>
        {/each}
      </div>
  {/if}
</div>
