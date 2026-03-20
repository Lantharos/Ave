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

  const selectedApp = $derived(apps.find((app) => app.id === selectedAppId) || null);
  const activeMembers = $derived(workspace.members.filter((member) => member.status === "active").length);
  const workspaceAvatar = $derived(workspace.members.find((member) => member.avatarUrl)?.avatarUrl || null);
  const accountAvatar = $derived(workspace.members[0]?.avatarUrl || workspaceAvatar);

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        workspaceOpen = false;
        appOpen = false;
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  function closeMenus() {
    workspaceOpen = false;
    appOpen = false;
  }
</script>

<div class="rounded-[30px] bg-[#0d0d0d]/88 px-4 py-4 md:px-5 md:py-5 backdrop-blur-[24px] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
  <div class="flex items-center justify-between gap-4 flex-wrap">
    <div class="flex min-w-0 items-center gap-2 md:gap-3 flex-wrap">
      <button
        class="flex min-w-0 items-center gap-3 rounded-full bg-white/[0.04] px-3 py-2.5 md:px-4 md:py-3 text-left text-white border-0 cursor-pointer transition-colors duration-300 hover:bg-white/[0.07]"
        onclick={() => {
          workspaceOpen = !workspaceOpen;
          appOpen = false;
        }}
      >
        {#if workspaceAvatar}
          <img src={workspaceAvatar} alt="" class="h-11 w-11 rounded-full object-cover shrink-0" />
        {:else}
          <span class="flex h-11 w-11 items-center justify-center rounded-full bg-[#171717] text-[13px] font-black text-[#d4d4d4] shrink-0">
            {getInitials(workspace.name)}
          </span>
        {/if}
        <span class="flex min-w-0 flex-col leading-none">
          <span class="truncate text-[14px] md:text-[15px] font-semibold">{workspace.name}</span>
          <span class="truncate pt-1 text-[12px] text-[#7d7d7d]">{activeMembers} members</span>
        </span>
        <svg class="h-4 w-4 text-[#7d7d7d] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div class="hidden text-[#3f3f3f] md:block">/</div>

      <button
        class="flex min-w-0 items-center gap-3 rounded-full bg-white/[0.04] px-3 py-2.5 md:px-4 md:py-3 text-left text-white border-0 cursor-pointer transition-colors duration-300 hover:bg-white/[0.07]"
        onclick={() => {
          appOpen = !appOpen;
          workspaceOpen = false;
        }}
      >
        <span class="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#171717] shrink-0">
          {#if selectedApp?.iconUrl}
            <img src={selectedApp.iconUrl} alt="" class="h-6 w-6 rounded-[10px] object-cover" />
          {:else}
            <svg class="h-5 w-5 text-[#8a8a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          {/if}
        </span>
        <span class="flex min-w-0 flex-col leading-none">
          <span class="truncate text-[14px] md:text-[15px] font-semibold">{selectedApp?.name || "Applications"}</span>
          <span class="truncate pt-1 text-[12px] text-[#7d7d7d]">{selectedApp ? selectedApp.clientId : `${apps.length} apps`}</span>
        </span>
        <svg class="h-4 w-4 text-[#7d7d7d] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <Button variant="ghost" size="sm" onclick={onopenteam}>Invite</Button>
      <Button variant="primary" size="sm" onclick={oncreateapp}>Create app</Button>
      <button
        aria-label="Sign out"
        class="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-0 bg-white/[0.04] text-white cursor-pointer transition-colors duration-300 hover:bg-white/[0.08]"
        onclick={onsignout}
      >
        {#if accountAvatar}
          <img src={accountAvatar} alt="" class="h-full w-full object-cover" />
        {:else}
          <span class="text-[13px] font-black">{getInitials(workspace.members[0]?.name || workspace.name)}</span>
        {/if}
      </button>
    </div>
  </div>
</div>

{#if workspaceOpen}
  <button aria-label="Close organization switcher" class="fixed inset-0 z-[70] border-0 bg-black/55 backdrop-blur-[6px] cursor-pointer" onclick={closeMenus}></button>
  <div class="fixed inset-x-3 top-[92px] z-[80] mx-auto w-auto max-w-[760px] rounded-[30px] bg-[#101010] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:inset-x-5 md:p-5">
    <div class="flex items-center justify-between gap-4 px-2 pb-4">
      <div>
        <p class="m-0 text-[20px] font-semibold text-white">Organizations</p>
        <p class="m-0 pt-1 text-[13px] text-[#777]">Switch workspace or manage your team.</p>
      </div>
      <button aria-label="Close organization switcher" class="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-white/[0.04] text-[#9a9a9a] cursor-pointer transition-colors duration-300 hover:bg-white/[0.08] hover:text-white" onclick={closeMenus}>
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
      <div class="flex max-h-[420px] flex-col gap-2 overflow-y-auto rounded-[26px] bg-white/[0.03] p-2">
        {#each organizations as organization}
          <button
            class="flex items-center justify-between gap-4 rounded-[22px] border-0 px-4 py-4 text-left cursor-pointer transition-colors duration-300 {organization.id === currentOrganizationId ? 'bg-white/[0.07]' : 'bg-transparent hover:bg-white/[0.05]'}"
            onclick={() => {
              closeMenus();
              onselectorganization(organization.id);
            }}
          >
            <span class="min-w-0">
              <span class="block truncate text-[15px] font-semibold text-white">{organization.name}</span>
              <span class="block pt-1 text-[13px] text-[#7d7d7d]">{organization.memberCount} members · {organization.appCount} apps</span>
            </span>
            <span class="rounded-full bg-white/[0.05] px-3 py-1.5 text-[12px] text-[#b0b0b0]">{organization.role}</span>
          </button>
        {/each}
      </div>

      <div class="flex flex-col gap-3">
        <div class="rounded-[26px] bg-white/[0.03] px-5 py-5">
          <p class="m-0 text-[18px] font-semibold text-white">{workspace.name}</p>
          <p class="m-0 pt-2 text-[14px] text-[#7d7d7d]">{activeMembers} active members</p>
        </div>
        <button class="rounded-[24px] border-0 bg-white/[0.03] px-5 py-4 text-left text-[15px] text-white cursor-pointer transition-colors duration-300 hover:bg-white/[0.05]" onclick={() => {
          closeMenus();
          onopenapps();
        }}>Applications</button>
        <button class="rounded-[24px] border-0 bg-white/[0.03] px-5 py-4 text-left text-[15px] text-white cursor-pointer transition-colors duration-300 hover:bg-white/[0.05]" onclick={() => {
          closeMenus();
          onopenteam();
        }}>Organization</button>
        <button class="rounded-[24px] border-0 bg-white/[0.03] px-5 py-4 text-left text-[15px] text-white cursor-pointer transition-colors duration-300 hover:bg-white/[0.05]" onclick={() => {
          closeMenus();
          onopensettings();
        }}>Settings</button>
      </div>
    </div>
  </div>
{/if}

{#if appOpen}
  <button aria-label="Close application switcher" class="fixed inset-0 z-[70] border-0 bg-black/55 backdrop-blur-[6px] cursor-pointer" onclick={closeMenus}></button>
  <div class="fixed inset-x-3 top-[92px] z-[80] mx-auto w-auto max-w-[860px] rounded-[30px] bg-[#101010] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.55)] md:inset-x-5 md:p-5">
    <div class="flex items-center justify-between gap-4 px-2 pb-4">
      <div>
        <p class="m-0 text-[20px] font-semibold text-white">Applications</p>
        <p class="m-0 pt-1 text-[13px] text-[#777]">Jump between apps without leaving the dashboard.</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="sm" onclick={() => {
          closeMenus();
          oncreateapp();
        }}>Create</Button>
        <button aria-label="Close application switcher" class="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-white/[0.04] text-[#9a9a9a] cursor-pointer transition-colors duration-300 hover:bg-white/[0.08] hover:text-white" onclick={closeMenus}>
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <button
        class="rounded-[24px] border-0 bg-white/[0.03] px-5 py-5 text-left cursor-pointer transition-colors duration-300 hover:bg-white/[0.05]"
        onclick={() => {
          closeMenus();
          onselectapp(null);
          onopenapps();
        }}
      >
        <p class="m-0 text-[16px] font-semibold text-white">All applications</p>
        <p class="m-0 pt-2 text-[13px] text-[#7d7d7d]">{apps.length} apps in this workspace</p>
      </button>

      {#each apps as app}
        <button
          class="flex items-center gap-4 rounded-[24px] border-0 bg-white/[0.03] px-5 py-5 text-left cursor-pointer transition-colors duration-300 {selectedAppId === app.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.05]'}"
          onclick={() => {
            closeMenus();
            onselectapp(app.id);
          }}
        >
          <span class="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#171717] shrink-0">
            {#if app.iconUrl}
              <img src={app.iconUrl} alt="" class="h-7 w-7 rounded-[10px] object-cover" />
            {:else}
              <svg class="h-5 w-5 text-[#8a8a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            {/if}
          </span>
          <span class="min-w-0">
            <span class="block truncate text-[15px] font-semibold text-white">{app.name}</span>
            <span class="block truncate pt-1 text-[13px] text-[#7d7d7d]">{app.clientId}</span>
          </span>
        </button>
      {/each}
    </div>
  </div>
{/if}
