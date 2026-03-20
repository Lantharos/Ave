<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
  import Input from "../components/Input.svelte";
  import type { WorkspaceState } from "../lib/portal";

  interface Props {
    workspace: WorkspaceState;
    appCount: number;
    onrename: (name: string) => void;
    onadddomain: (domain: string) => void;
    onuploadlogo: (file: File) => Promise<void>;
  }

  let { workspace, appCount, onrename, onadddomain, onuploadlogo }: Props = $props();

  let draftName = $state("");
  let domainDraft = $state("");
  let logoInput: HTMLInputElement | null = null;
  let uploadingLogo = $state(false);

  $effect(() => {
    draftName = workspace.name;
  });
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div class="flex flex-col gap-3">
    <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Settings</h1>
    <p class="m-0 max-w-[560px] text-[15px] text-[#7e7e7e]">Update workspace details and verified domains.</p>
  </div>

  <div class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
    <Card>
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <h2 class="m-0 text-[22px] font-semibold text-white">Workspace profile</h2>
          <p class="m-0 text-[14px] leading-6 text-[#7d7d7d]">Name and workspace details used across your dashboard.</p>
        </div>

        <label class="flex flex-col gap-3">
          <span class="text-[14px] text-[#8a8a8a]">Name</span>
          <Input bind:value={draftName} placeholder="Workspace name" />
        </label>

        <div class="flex items-center justify-between gap-4 rounded-[22px] bg-white/[0.03] px-5 py-5 flex-wrap">
          <div class="flex items-center gap-4">
            {#if workspace.logoUrl}
              <img src={workspace.logoUrl} alt="" class="h-14 w-14 rounded-[18px] object-cover" />
            {:else}
              <div class="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white/[0.05] text-[18px] font-black text-white">
                {workspace.name.slice(0, 1).toUpperCase()}
              </div>
            {/if}
            <div>
              <p class="m-0 text-[15px] font-medium text-white">Workspace logo</p>
              <p class="m-0 mt-1 text-[13px] text-[#7d7d7d]">Upload a custom mark for this workspace.</p>
            </div>
          </div>
          <div>
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
            <Button variant="outline" size="sm" onclick={() => logoInput?.click()}>{uploadingLogo ? "Uploading..." : "Upload logo"}</Button>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-[22px] bg-white/[0.03] px-5 py-5">
            <p class="m-0 text-[13px] text-[#666]">Workspace ID</p>
            <p class="m-0 mt-2 break-all text-[15px] font-medium text-white">{workspace.id}</p>
          </div>
          <div class="rounded-[22px] bg-white/[0.03] px-5 py-5">
            <p class="m-0 text-[13px] text-[#666]">Usage</p>
            <p class="m-0 mt-2 text-[15px] font-medium text-white">{appCount} of {workspace.appLimit} apps used</p>
          </div>
        </div>

        <div class="flex justify-end">
          <Button variant="primary" size="sm" onclick={() => onrename(draftName.trim() || workspace.name)}>Save profile</Button>
        </div>
      </div>
    </Card>

    <div class="flex flex-col gap-4">
      <Card>
        <div class="flex flex-col gap-6">
          <div class="flex flex-col gap-2">
            <h2 class="m-0 text-[22px] font-semibold text-white">Verified domains</h2>
            <p class="m-0 text-[14px] leading-6 text-[#7d7d7d]">Add domains your team uses so they stay attached to this workspace.</p>
          </div>

          <div class="flex flex-col gap-3">
            {#if workspace.verifiedDomains.length}
              {#each workspace.verifiedDomains as domain}
                <div class="rounded-[20px] bg-white/[0.03] px-4 py-4 text-[14px] text-[#b0b0b0]">{domain}</div>
              {/each}
            {:else}
              <div class="rounded-[20px] bg-white/[0.03] px-4 py-4 text-[14px] text-[#6d6d6d]">No verified domains yet.</div>
            {/if}
          </div>

          <div class="flex gap-3 flex-wrap">
            <div class="min-w-[220px] flex-1">
              <Input bind:value={domainDraft} placeholder="company.com" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onclick={() => {
                if (!domainDraft.trim()) return;
                onadddomain(domainDraft.trim().toLowerCase());
                domainDraft = "";
              }}
            >
              Add domain
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
</div>
