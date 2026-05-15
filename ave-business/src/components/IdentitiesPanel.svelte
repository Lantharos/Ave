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
    canManageIdentities,
    busy,
    onAdd,
    onRoleChange,
    onRemove,
  }: Props = $props();
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
        <div class="grid gap-4 rounded-[24px] bg-white/[0.03] px-4 py-4 xl:grid-cols-[1fr_auto_auto] xl:items-center">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-[13px] font-black text-white">
              {initials(member.displayName)}
            </div>
            <div class="min-w-0">
              <p class="m-0 truncate text-[15px] font-semibold text-white">{member.displayName}</p>
              <p class="m-0 mt-1 truncate text-[13px] text-[#777]">@{member.handle}{member.hasEncryptionKey ? "" : " · no identity key"}</p>
            </div>
          </div>
          <Segmented value={member.role} options={roleOptions} onchange={(role) => onRoleChange(member, role)} />
          <button
            class="flex min-h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-[#777] transition-colors duration-300 hover:bg-[#E14747]/10 hover:text-[#E14747]"
            onclick={() => onRemove(member)}
            aria-label={`Remove ${member.handle}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      {/each}
    </div>
  </div>
</Panel>
