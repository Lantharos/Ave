<script lang="ts">
  import { onMount } from "svelte";
  import Button from "./Button.svelte";
  import type { DevApp } from "../lib/api";
  import type { WorkspaceState, WorkspaceSummary } from "../lib/portal";
  import { getInitials } from "../lib/portal";

  interface Props {
    workspace: WorkspaceState;
    organizations: WorkspaceSummary[];
    currentOrganizationId: string;
    apps: DevApp[];
    selectedAppId: string | null;
    environmentLabel: string;
    onselectorganization: (organizationId: string) => void;
    onselectapp: (appId: string | null) => void;
    onopenapps: () => void;
    onopenteam: () => void;
    onopensettings: () => void;
    oncreateapp: () => void;
    onsignout: () => void;
  }

  let {
    workspace,
    organizations,
    currentOrganizationId,
    apps,
    selectedAppId,
    environmentLabel,
    onselectorganization,
    onselectapp,
    onopenapps,
    onopenteam,
    onopensettings,
    oncreateapp,
    onsignout,
  }: Props = $props();

  let workspaceOpen = $state(false);
  let appOpen = $state(false);
  let menuRoot: HTMLDivElement | null = null;

  const selectedApp = $derived(apps.find((app) => app.id === selectedAppId) || null);
  const activeMembers = $derived(workspace.members.filter((member) => member.status === "active").length);

  onMount(() => {
    const handlePointer = (event: PointerEvent) => {
      if (!menuRoot?.contains(event.target as Node)) {
        workspaceOpen = false;
        appOpen = false;
      }
    };

    window.addEventListener("pointerdown", handlePointer);
    return () => window.removeEventListener("pointerdown", handlePointer);
  });
</script>

<div bind:this={menuRoot} class="relative rounded-[28px] bg-[#0d0d0d]/88 px-4 py-4 md:px-5 md:py-5 backdrop-blur-[24px] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="flex items-center gap-2 md:gap-3 flex-wrap">
      <div class="relative">
        <button
          class="flex items-center gap-3 rounded-full bg-white/[0.04] px-3 py-2 md:px-4 md:py-3 text-left text-white border-0 cursor-pointer transition-colors duration-300 hover:bg-white/[0.07]"
          onclick={() => {
            workspaceOpen = !workspaceOpen;
            appOpen = false;
          }}
        >
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-[#171717] text-[13px] font-black text-[#d4d4d4]">
            {getInitials(workspace.name)}
          </span>
          <span class="flex flex-col leading-none">
            <span class="text-[14px] md:text-[15px] font-semibold">{workspace.name}</span>
            <span class="text-[12px] text-[#7d7d7d]">{workspace.plan} workspace</span>
          </span>
          <svg class="h-4 w-4 text-[#7d7d7d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {#if workspaceOpen}
          <div class="absolute left-0 top-[calc(100%+12px)] z-30 min-w-[300px] rounded-[24px] bg-[#121212] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div class="px-2 pb-2">
              <p class="m-0 text-[12px] font-medium text-[#7d7d7d]">Organizations</p>
            </div>
            <div class="flex max-h-[300px] flex-col gap-1 overflow-y-auto">
              {#each organizations as organization}
                <button
                  class="flex items-center justify-between gap-3 rounded-[18px] border-0 px-4 py-3 text-left cursor-pointer transition-colors duration-300 {organization.id === currentOrganizationId ? 'bg-white/[0.05]' : 'bg-transparent hover:bg-white/[0.04]'}"
                  onclick={() => {
                    workspaceOpen = false;
                    onselectorganization(organization.id);
                  }}
                >
                  <span class="min-w-0">
                    <span class="block truncate text-[14px] font-medium text-white">{organization.name}</span>
                    <span class="mt-1 block text-[12px] text-[#7d7d7d]">{organization.memberCount} members · {organization.appCount} apps</span>
                  </span>
                  <span class="rounded-full bg-white/[0.04] px-2 py-1 text-[11px] text-[#9b9b9b]">{organization.role}</span>
                </button>
              {/each}
            </div>
            <div class="mt-2 rounded-[20px] bg-white/[0.03] px-4 py-4">
              <p class="m-0 text-[14px] font-semibold text-white">{workspace.name}</p>
              <p class="m-0 mt-1 text-[13px] text-[#7d7d7d]">{activeMembers} member{activeMembers === 1 ? "" : "s"} active</p>
            </div>
            <div class="mt-2 flex flex-col gap-1">
              <button class="rounded-[18px] border-0 bg-transparent px-4 py-3 text-left text-[14px] text-[#8e8e8e] cursor-pointer transition-colors duration-300 hover:bg-white/[0.04] hover:text-white" onclick={() => {
                workspaceOpen = false;
                onopenapps();
              }}>Applications</button>
              <button class="rounded-[18px] border-0 bg-transparent px-4 py-3 text-left text-[14px] text-[#8e8e8e] cursor-pointer transition-colors duration-300 hover:bg-white/[0.04] hover:text-white" onclick={() => {
                workspaceOpen = false;
                onopenteam();
              }}>Organization</button>
              <button class="rounded-[18px] border-0 bg-transparent px-4 py-3 text-left text-[14px] text-[#8e8e8e] cursor-pointer transition-colors duration-300 hover:bg-white/[0.04] hover:text-white" onclick={() => {
                workspaceOpen = false;
                onopensettings();
              }}>Settings</button>
            </div>
          </div>
        {/if}
      </div>

      <div class="text-[#474747]">/</div>

      <div class="relative">
        <button
          class="flex items-center gap-3 rounded-full bg-white/[0.04] px-3 py-2 md:px-4 md:py-3 text-left text-white border-0 cursor-pointer transition-colors duration-300 hover:bg-white/[0.07]"
          onclick={() => {
            appOpen = !appOpen;
            workspaceOpen = false;
          }}
        >
          <span class="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#171717]">
            {#if selectedApp?.iconUrl}
              <img src={selectedApp.iconUrl} alt="" class="h-6 w-6 rounded-[10px]" />
            {:else}
              <svg class="h-5 w-5 text-[#8a8a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            {/if}
          </span>
          <span class="flex flex-col leading-none">
            <span class="text-[14px] md:text-[15px] font-semibold">{selectedApp?.name || "Applications"}</span>
            <span class="text-[12px] text-[#7d7d7d]">{selectedApp ? selectedApp.clientId : `${apps.length} apps`}</span>
          </span>
          <svg class="h-4 w-4 text-[#7d7d7d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {#if appOpen}
          <div class="absolute left-0 top-[calc(100%+12px)] z-30 min-w-[320px] rounded-[24px] bg-[#121212] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div class="flex items-center justify-between px-2 pb-2">
              <p class="m-0 text-[12px] font-medium text-[#7d7d7d]">Applications</p>
              <button class="border-0 bg-transparent px-2 py-1 text-[12px] text-[#b9bbbe] cursor-pointer" onclick={() => {
                appOpen = false;
                oncreateapp();
              }}>Create</button>
            </div>
            <div class="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
              <button
                class="rounded-[18px] border-0 bg-transparent px-4 py-3 text-left text-[14px] text-[#8e8e8e] cursor-pointer transition-colors duration-300 hover:bg-white/[0.04] hover:text-white"
                onclick={() => {
                  appOpen = false;
                  onselectapp(null);
                  onopenapps();
                }}
              >
                All applications
              </button>
              {#each apps as app}
                <button
                  class="flex items-center gap-3 rounded-[18px] border-0 px-4 py-3 text-left cursor-pointer transition-colors duration-300 {selectedAppId === app.id ? 'bg-white/[0.05]' : 'bg-transparent hover:bg-white/[0.04]'}"
                  onclick={() => {
                    appOpen = false;
                    onselectapp(app.id);
                  }}
                >
                  <span class="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#171717]">
                    {#if app.iconUrl}
                      <img src={app.iconUrl} alt="" class="h-5 w-5 rounded-[8px]" />
                    {:else}
                      <svg class="h-4 w-4 text-[#8a8a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    {/if}
                  </span>
                  <span class="flex flex-col leading-none">
                    <span class="text-[14px] font-medium text-white">{app.name}</span>
                    <span class="mt-1 text-[12px] text-[#7d7d7d]">{app.resources?.length || 0} resources</span>
                  </span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      {#if selectedApp}
        <div class="rounded-full bg-[#ca7a29]/12 px-3 py-2 text-[13px] font-medium text-[#d7a162]">
          {environmentLabel}
        </div>
      {/if}
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <Button variant="ghost" size="sm" onclick={onopenteam}>Invite</Button>
      <Button variant="primary" size="sm" onclick={oncreateapp}>Create app</Button>
      <button
        aria-label="Sign out"
        class="flex h-11 w-11 items-center justify-center rounded-full border-0 bg-white/[0.04] text-white cursor-pointer transition-colors duration-300 hover:bg-white/[0.08]"
        onclick={onsignout}
      >
        <span class="text-[13px] font-black">{getInitials(workspace.members[0]?.name || workspace.name)}</span>
      </button>
    </div>
  </div>
</div>
