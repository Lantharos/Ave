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
  }

  let { workspace, oninvite, onchangerole }: Props = $props();

  let search = $state("");
  let inviteEmail = $state("");
  let inviteRole = $state<WorkspaceRole>("admin");

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
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="flex flex-col gap-3">
      <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Organization</h1>
      <p class="m-0 max-w-[720px] text-[15px] md:text-[18px] font-medium text-[#7e7e7e]">
        Teams make the portal feel real. Keep ownership, invites, and role changes close to the surface so adding another developer doesn’t feel like a side quest.
      </p>
    </div>
  </div>

  <div class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
    <Card>
      <div class="flex flex-col gap-6">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] text-[15px] font-black text-white">
              {getInitials(workspace.name)}
            </div>
            <div>
              <p class="m-0 text-[20px] font-semibold text-white">{workspace.name}</p>
              <p class="m-0 mt-1 text-[14px] text-[#7d7d7d]">{activeMembers.length} active member{activeMembers.length === 1 ? "" : "s"} and {invites.length} invite{invites.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <div class="rounded-full bg-white/[0.04] px-4 py-2 text-[13px] text-[#a0a0a0]">
            {workspace.plan} plan
          </div>
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
                  <div class="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05] text-[13px] font-black text-white shrink-0">
                    {getInitials(member.name)}
                  </div>
                  <div class="min-w-0">
                    <p class="m-0 truncate text-[15px] font-medium text-white">{member.name}</p>
                    <p class="m-0 mt-1 truncate text-[13px] text-[#7d7d7d]">{member.email}</p>
                  </div>
                </div>
                <div class="text-[14px] text-[#8a8a8a]">{formatDate(member.joinedAt)}</div>
                <div class="flex flex-wrap gap-2">
                  {#each ["owner", "admin", "viewer"] as role}
                    <button
                      class="rounded-full border-0 px-3 py-1.5 text-[12px] cursor-pointer transition-colors duration-300 {member.role === role ? 'bg-white text-[#090909]' : 'bg-white/[0.05] text-[#8d8d8d] hover:text-white'}"
                      onclick={() => onchangerole(member.id, role as WorkspaceRole)}
                      disabled={member.status === "invited"}
                    >
                      {role}
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <h2 class="m-0 text-[22px] font-semibold text-white">Invite teammate</h2>
          <p class="m-0 text-[14px] leading-6 text-[#7d7d7d]">Start with owner and admin roles. That is enough to shift the portal from personal playground to shared workspace.</p>
        </div>

        <label class="flex flex-col gap-3">
          <span class="text-[14px] text-[#8a8a8a]">Email</span>
          <Input bind:value={inviteEmail} placeholder="name@company.com" />
        </label>

        <div class="flex flex-col gap-3">
          <span class="text-[14px] text-[#8a8a8a]">Role</span>
          <div class="flex gap-2 flex-wrap">
            {#each ["owner", "admin", "viewer"] as role}
              <button
                class="rounded-full border-0 px-4 py-2 text-[13px] cursor-pointer transition-colors duration-300 {inviteRole === role ? 'bg-white text-[#090909]' : 'bg-white/[0.05] text-[#8d8d8d] hover:text-white'}"
                onclick={() => (inviteRole = role as WorkspaceRole)}
              >
                {role}
              </button>
            {/each}
          </div>
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
          Invite user
        </Button>

        <div class="rounded-[24px] bg-white/[0.03] px-5 py-5">
          <p class="m-0 text-[14px] text-[#7d7d7d]">Verified domains</p>
          <div class="mt-4 flex flex-wrap gap-2">
            {#if workspace.verifiedDomains.length}
              {#each workspace.verifiedDomains as domain}
                <span class="rounded-full bg-white/[0.05] px-3 py-2 text-[13px] text-[#b1b1b1]">{domain}</span>
              {/each}
            {:else}
              <span class="text-[13px] text-[#656565]">No verified domains yet.</span>
            {/if}
          </div>
        </div>
      </div>
    </Card>
  </div>
</div>
