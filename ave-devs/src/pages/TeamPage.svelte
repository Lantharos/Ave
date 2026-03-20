<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
  import Input from "../components/Input.svelte";
  import type { WorkspaceRole, WorkspaceState } from "../lib/portal";
  import { formatDate, getInitials } from "../lib/portal";

  interface Props {
    workspace: WorkspaceState;
    oninvite: (email: string, role: WorkspaceRole) => void;
    onchangerole: (memberId: string, role: WorkspaceRole) => void;
    onuploadlogo: (file: File) => Promise<void>;
    onrename: (name: string) => void;
  }

  let { workspace, oninvite, onchangerole, onuploadlogo, onrename }: Props = $props();

  let search = $state("");
  let inviteEmail = $state("");
  let inviteRole = $state<Exclude<WorkspaceRole, "owner">>("admin");
  let draftName = $state("");
  let logoInput: HTMLInputElement | null = null;
  let uploadingLogo = $state(false);

  $effect(() => {
    draftName = workspace.name;
  });

  const visibleMembers = $derived(
    search.trim()
      ? workspace.members.filter((member) =>
          [member.name, member.email || "", member.role].some((value) =>
            value.toLowerCase().includes(search.trim().toLowerCase()),
          ),
        )
      : workspace.members,
  );

  const activeMembers = $derived(workspace.members.filter((member) => member.status === "active"));
  const invites = $derived(workspace.members.filter((member) => member.status === "invited"));
  const workspaceAvatar = $derived(workspace.logoUrl || null);
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="flex flex-col gap-3">
      <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Organization</h1>
      <p class="m-0 max-w-[560px] text-[15px] text-[#7e7e7e]">Manage the workspace profile, members, and roles.</p>
    </div>
  </div>

  <div class="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
    <Card>
      <div class="flex flex-col gap-6">
        <div class="flex items-center gap-4">
          <button class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[22px] border-0 bg-white/[0.04] cursor-pointer transition-colors duration-300 hover:bg-white/[0.06]" onclick={() => logoInput?.click()}>
            {#if workspaceAvatar}
              <img src={workspaceAvatar} alt="" class="h-full w-full object-cover" />
            {:else}
              <span class="text-[20px] font-black text-white">{getInitials(workspace.name).slice(0, 1)}</span>
            {/if}
          </button>
          <div>
            <p class="m-0 text-[20px] font-semibold text-white">{workspace.name}</p>
            <p class="m-0 mt-1 text-[14px] text-[#7d7d7d]">{activeMembers.length} active members</p>
          </div>
        </div>

        <input bind:this={logoInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" onchange={async (event) => {
          const input = event.currentTarget as HTMLInputElement;
          const file = input.files?.[0];
          if (!file) return;
          uploadingLogo = true;
          try {
            await onuploadlogo(file);
          } finally {
            uploadingLogo = false;
            input.value = "";
          }
        }} />

        <label class="flex flex-col gap-3">
          <span class="text-[14px] text-[#8a8a8a]">Name</span>
          <Input bind:value={draftName} placeholder="Workspace name" />
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-[22px] bg-white/[0.03] px-5 py-5">
            <p class="m-0 text-[13px] text-[#666]">Workspace ID</p>
            <p class="m-0 mt-2 overflow-x-auto whitespace-nowrap text-[14px] font-medium text-white [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {workspace.id}
            </p>
          </div>
          <div class="rounded-[22px] bg-white/[0.03] px-5 py-5">
            <p class="m-0 text-[13px] text-[#666]">Pending invites</p>
            <p class="m-0 mt-2 text-[20px] font-semibold text-white">{invites.length}</p>
          </div>
        </div>

        <div class="flex justify-between gap-3 flex-wrap">
          <Button variant="outline" size="sm" onclick={() => logoInput?.click()}>{uploadingLogo ? "Uploading..." : "Change icon"}</Button>
          <Button variant="primary" size="sm" onclick={() => onrename(draftName.trim() || workspace.name)}>Save</Button>
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex flex-col gap-6">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 class="m-0 text-[22px] font-semibold text-white">Members</h2>
            <p class="m-0 mt-2 text-[14px] text-[#7d7d7d]">Invite teammates and adjust access.</p>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div class="min-w-0">
            <Input bind:value={inviteEmail} placeholder="name@company.com" />
          </div>
          <div class="flex gap-2 flex-wrap">
            {#each ["admin", "viewer"] as role}
              <button
                class="rounded-full border-0 px-4 py-2 text-[13px] cursor-pointer transition-colors duration-300 {inviteRole === role ? 'bg-white text-[#090909]' : 'bg-white/[0.05] text-[#8d8d8d] hover:text-white'}"
                onclick={() => (inviteRole = role as Exclude<WorkspaceRole, "owner">)}
              >
                {role}
              </button>
            {/each}
          </div>
          <Button
            variant="primary"
            size="sm"
            onclick={() => {
              if (!inviteEmail.trim()) return;
              oninvite(inviteEmail.trim(), inviteRole);
              inviteEmail = "";
              inviteRole = "admin";
            }}
          >
            Invite
          </Button>
        </div>

        <div class="relative">
          <svg class="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            class="w-full rounded-full border-0 bg-white/[0.04] px-5 py-3 pl-12 text-[15px] text-white outline-none placeholder:text-[#555] focus:bg-white/[0.06]"
            bind:value={search}
            placeholder="Search members"
          />
        </div>

        <div class="overflow-hidden rounded-[24px] bg-[#0d0d0d]/55">
          <div class="grid grid-cols-[1.4fr_1fr_0.8fr] gap-4 px-5 py-4 text-[12px] text-[#666] max-md:hidden">
            <span>Member</span>
            <span>Joined</span>
            <span>Role</span>
          </div>
          <div class="flex flex-col">
            {#each visibleMembers as member}
              <div class="grid gap-4 px-5 py-4 items-center odd:bg-white/[0.02] md:grid-cols-[1.4fr_1fr_0.8fr]">
                <div class="flex items-center gap-3 min-w-0">
                  {#if member.avatarUrl}
                    <img src={member.avatarUrl} alt="" class="h-11 w-11 rounded-full object-cover shrink-0" />
                  {:else}
                    <div class="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05] text-[13px] font-black text-white shrink-0">
                      {getInitials(member.name)}
                    </div>
                  {/if}
                  <div class="min-w-0">
                    <p class="m-0 truncate text-[15px] font-medium text-white">{member.name}</p>
                    <p class="m-0 mt-1 truncate text-[13px] text-[#7d7d7d]">{member.email || "No email"}</p>
                  </div>
                </div>
                <div class="text-[14px] text-[#8a8a8a]">{formatDate(member.joinedAt)}</div>
                <div class="flex flex-wrap gap-2">
                  {#if member.role === "owner"}
                    <span class="rounded-full bg-white px-3 py-1.5 text-[12px] text-[#090909]">owner</span>
                  {:else}
                    {#each ["admin", "viewer"] as role}
                      <button
                        class="rounded-full border-0 px-3 py-1.5 text-[12px] cursor-pointer transition-colors duration-300 {member.role === role ? 'bg-white text-[#090909]' : 'bg-white/[0.05] text-[#8d8d8d] hover:text-white'}"
                        onclick={() => onchangerole(member.id, role as WorkspaceRole)}
                        disabled={member.status === "invited"}
                      >
                        {role}
                      </button>
                    {/each}
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </Card>
  </div>
</div>
