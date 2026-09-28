<script lang="ts">
  import Button from "$lib/surfaces/devs/components/Button.svelte";
  import Card from "$lib/surfaces/devs/components/Card.svelte";
  import Input from "$lib/surfaces/devs/components/Input.svelte";
  import { countLabel, formatDate, getInitials, type WorkspaceState } from "$lib/surfaces/devs/lib/portal";

  interface Props {
    workspace: WorkspaceState;
    onaddmember: (email: string) => Promise<void>;
    onremovemember: (memberId: string) => Promise<void>;
    onuploadlogo: (file: File) => Promise<void>;
    onrename: (name: string) => void;
  }

  let { workspace, onaddmember, onremovemember, onuploadlogo, onrename }: Props = $props();

  let search = $state("");
  let memberEmail = $state("");
  let addingMember = $state(false);
  let removingMemberId = $state<string | null>(null);
  let draftName = $derived(workspace.name);
  let logoInput: HTMLInputElement | null = null;
  let uploadingLogo = $state(false);

  const visibleMembers = $derived(
    search.trim()
      ? workspace.members.filter((member) =>
          [member.name, member.email || ""].some((value) =>
            value.toLowerCase().includes(search.trim().toLowerCase()),
          ),
        )
      : workspace.members,
  );
  const canRemoveMembers = $derived(workspace.members.length > 1);

  async function addMember() {
    const email = memberEmail.trim();
    if (!email) return;
    addingMember = true;
    try {
      await onaddmember(email);
      memberEmail = "";
    } finally {
      addingMember = false;
    }
  }

  async function removeMember(memberId: string) {
    removingMemberId = memberId;
    try {
      await onremovemember(memberId);
    } finally {
      removingMemberId = null;
    }
  }
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div class="flex flex-col gap-3">
    <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Organization</h1>
    <p class="m-0 max-w-[560px] text-[15px] text-[#7e7e7e]">Everyone in this workspace can manage its apps, members, and profile.</p>
  </div>

  <div class="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
    <Card>
      <div class="flex flex-col gap-6">
        <div class="flex items-center gap-4">
          <button class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[22px] border-0 bg-white/[0.04] cursor-pointer transition-colors duration-300 hover:bg-white/[0.06]" onclick={() => logoInput?.click()} disabled={uploadingLogo} aria-label="Change workspace icon">
            {#if workspace.logoUrl}
              <img src={workspace.logoUrl} alt="" class="h-full w-full object-cover" />
            {:else}
              <span class="text-[20px] font-black text-white">{getInitials(workspace.name).slice(0, 1)}</span>
            {/if}
          </button>
          <div>
            <p class="m-0 text-[20px] font-semibold text-white">{workspace.name}</p>
            <p class="m-0 mt-1 text-[14px] text-[#7d7d7d]">{countLabel(workspace.members.length, "member")}</p>
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

        <div class="rounded-[22px] bg-white/[0.03] px-5 py-5">
          <p class="m-0 text-[13px] text-[#666]">Workspace ID</p>
          <p class="m-0 mt-2 overflow-x-auto whitespace-nowrap text-[14px] font-medium text-white [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {workspace.id}
          </p>
        </div>

        <div class="flex justify-between gap-3 flex-wrap">
          <Button variant="outline" size="sm" onclick={() => logoInput?.click()}>{uploadingLogo ? "Uploading..." : "Change icon"}</Button>
          <Button variant="primary" size="sm" onclick={() => onrename(draftName.trim() || workspace.name)}>Save</Button>
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex flex-col gap-6">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Members</h2>
          <p class="m-0 mt-2 text-[14px] text-[#7d7d7d]">Add teammates by the verified email on their Ave identity.</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div class="min-w-0">
            <Input bind:value={memberEmail} placeholder="name@company.com" />
          </div>
          <Button variant="primary" size="sm" onclick={addMember} disabled={addingMember || !memberEmail.trim()}>
            {addingMember ? "Adding..." : "Add member"}
          </Button>
        </div>

        {#if workspace.members.length > 6}
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
        {/if}

        <div class="overflow-hidden rounded-[24px] bg-[#0d0d0d]/55">
          {#each visibleMembers as member (member.id)}
            <div class="flex items-center gap-4 px-5 py-4 odd:bg-white/[0.02]">
              {#if member.avatarUrl}
                <img src={member.avatarUrl} alt="" class="h-11 w-11 rounded-full object-cover shrink-0" />
              {:else}
                <div class="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05] text-[13px] font-black text-white shrink-0">
                  {getInitials(member.name)}
                </div>
              {/if}
              <div class="min-w-0 flex-1">
                <p class="m-0 truncate text-[15px] font-medium text-white">{member.name}</p>
                <p class="m-0 mt-1 truncate text-[13px] text-[#7d7d7d]">{member.email || "No email"} · joined {formatDate(member.joinedAt)}</p>
              </div>
              {#if canRemoveMembers}
                <button
                  class="shrink-0 rounded-full border-0 bg-white/[0.05] px-3 py-1.5 text-[12px] text-[#8d8d8d] cursor-pointer transition-colors duration-300 hover:bg-[#e14747]/10 hover:text-[#e14747] disabled:opacity-50 disabled:pointer-events-none"
                  onclick={() => removeMember(member.id)}
                  disabled={removingMemberId === member.id}
                >
                  {removingMemberId === member.id ? "Removing..." : "Remove"}
                </button>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </Card>
  </div>
</div>
