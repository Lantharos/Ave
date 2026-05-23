<script lang="ts">
  import { Trash2 } from "lucide-svelte";
  import type { BusinessMember, BusinessRole } from "../lib/types";
  import { initials } from "../lib/format";
  import Button from "./Button.svelte";
  import Input from "./Input.svelte";
  import Panel from "./Panel.svelte";
  import Segmented from "./Segmented.svelte";

  interface Props {
    members: BusinessMember[];
    addHandle: string;
    addRole: BusinessRole;
    roleOptions: { value: BusinessRole; label: string }[];
    actingIdentityId: string;
    canManageIdentities: boolean;
    busy: boolean;
    onAdd: () => void;
    onRoleChange: (member: BusinessMember, role: BusinessRole) => void;
    onRemove: (member: BusinessMember) => void;
  }

  let {
    members,
    addHandle = $bindable(),
    addRole = $bindable(),
    roleOptions,
    actingIdentityId,
    canManageIdentities,
    busy,
    onAdd,
    onRoleChange,
    onRemove,
  }: Props = $props();

  function canEditMember(member: BusinessMember) {
    return canManageIdentities && member.role !== "owner" && member.identityId !== actingIdentityId;
  }

  function roleLabel(member: BusinessMember) {
    return member.identityId === actingIdentityId ? `${member.role} · you` : member.role;
  }
</script>

<Panel>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="m-0 text-[24px] font-semibold text-white">Identities</h3>
        <p class="m-0 mt-2 text-[14px] leading-6 text-[#858585]">Manage who can act for this organization.</p>
      </div>
      <span class="tabular-nums text-[13px] text-[#777]">{members.length} active</span>
    </div>

    {#if canManageIdentities}
      <div class="grid gap-3 xl:grid-cols-[1fr_auto_auto]">
        <Input bind:value={addHandle} placeholder="@handle" />
        <Segmented value={addRole} options={roleOptions} onchange={(role) => (addRole = role)} />
        <Button onclick={onAdd} disabled={busy || !addHandle.trim()}>Add</Button>
      </div>
    {/if}

    <div class="flex flex-col gap-2">
      {#each members as member (member.id)}
        <div class="flex flex-wrap items-center justify-between gap-4 rounded-[14px] bg-[#151515] px-4 py-3.5">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#202020] text-[13px] font-semibold text-white">
              {initials(member.displayName)}
            </div>
            <div class="min-w-0">
              <p class="m-0 truncate text-[15px] font-semibold text-white">{member.displayName}</p>
              <p class="m-0 mt-1 truncate text-[13px] text-[#777]">@{member.handle}{member.hasEncryptionKey ? "" : " · no identity key"}</p>
            </div>
          </div>
          <div class="flex min-h-10 items-center gap-3">
            {#if canEditMember(member)}
              <Segmented value={member.role} options={roleOptions} onchange={(role) => onRoleChange(member, role)} />
              <button
                class="flex min-h-10 w-10 items-center justify-center rounded-[12px] bg-[#1d1d1d] text-[#777] transition-[background-color,color,scale] duration-200 hover:bg-[#301717] hover:text-[#E14747] active:scale-[0.96]"
                onclick={() => onRemove(member)}
                aria-label={`Remove ${member.handle}`}
              >
                <Trash2 size={16} />
              </button>
            {:else}
              <span class="rounded-[12px] bg-[#1d1d1d] px-3 py-2 text-[13px] text-[#9a9a9a]">{roleLabel(member)}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</Panel>
