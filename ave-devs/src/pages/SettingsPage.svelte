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
  }

  let { workspace, appCount, onrename, onadddomain }: Props = $props();

  let draftName = $state("");
  let domainDraft = $state("");

  $effect(() => {
    draftName = workspace.name;
  });
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div class="flex flex-col gap-3">
    <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Settings</h1>
    <p class="m-0 max-w-[720px] text-[15px] md:text-[18px] font-medium text-[#7e7e7e]">
      Keep the workspace profile clean enough that invites, billing, and environment management can grow into it without a redesign later.
    </p>
  </div>

  <div class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
    <Card>
      <div class="flex flex-col gap-6">
        <div class="flex flex-col gap-2">
          <h2 class="m-0 text-[22px] font-semibold text-white">Workspace profile</h2>
          <p class="m-0 text-[14px] leading-6 text-[#7d7d7d]">Name, stable ID, and the pieces you would expect to survive once real organization persistence exists.</p>
        </div>

        <label class="flex flex-col gap-3">
          <span class="text-[14px] text-[#8a8a8a]">Name</span>
          <Input bind:value={draftName} placeholder="Workspace name" />
        </label>

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
            <p class="m-0 text-[14px] leading-6 text-[#7d7d7d]">Domain-based membership routing should be visible now even before deeper org automation lands.</p>
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

      <Card>
        <div class="flex flex-col gap-4">
          <h2 class="m-0 text-[22px] font-semibold text-white">Billing readiness</h2>
          <p class="m-0 text-[14px] leading-6 text-[#7d7d7d]">The portal now has the right structural hooks for future billing: org ownership, member roles, and app limits are already visible.</p>
          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded-[20px] bg-white/[0.03] px-4 py-4">
              <p class="m-0 text-[13px] text-[#666]">Plan</p>
              <p class="m-0 mt-2 text-[15px] font-medium text-white">{workspace.plan}</p>
            </div>
            <div class="rounded-[20px] bg-white/[0.03] px-4 py-4">
              <p class="m-0 text-[13px] text-[#666]">Application cap</p>
              <p class="m-0 mt-2 text-[15px] font-medium text-white">{workspace.appLimit}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</div>
