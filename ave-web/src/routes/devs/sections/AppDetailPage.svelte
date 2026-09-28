<script lang="ts">
  import Button from "$lib/surfaces/devs/components/Button.svelte";
  import Card from "$lib/surfaces/devs/components/Card.svelte";
  import Input from "$lib/surfaces/devs/components/Input.svelte";
  import Textarea from "$lib/surfaces/devs/components/Textarea.svelte";
  import Toggle from "$lib/surfaces/devs/components/Toggle.svelte";
  import type { DevApp } from "$lib/surfaces/devs/lib/api";
  import { countLabel, type WorkspaceSummary } from "$lib/surfaces/devs/lib/portal";

  interface AppDraft extends DevApp {
    redirectUrisText?: string;
  }

  interface Props {
    app: DevApp & { redirectUrisText?: string };
    organizations: WorkspaceSummary[];
    onsave: (app: DevApp & { redirectUrisText?: string }) => void;
    onrotate: (appId: string) => void;
    ondelete: (app: DevApp) => void;
    oncopy: (text: string) => void;
    saving: boolean;
    saved: boolean;
    rotating: boolean;
    rotated: boolean;
  }

  let {
    app = $bindable(),
    organizations,
    onsave,
    onrotate,
    ondelete,
    oncopy,
    saving,
    saved,
    rotating,
    rotated,
  }: Props = $props();

  let copiedField = $state<string | null>(null);
  let draft = $state<AppDraft>({
    ...app,
    redirectUrisText: app.redirectUrisText,
  });
  let transferSyncKey = $state("");

  const transferPending = $derived((draft.organizationId || null) !== (app.organizationId || null));
  const currentOrganizationName = $derived.by(
    () => organizations.find((organization) => organization.id === app.organizationId)?.name || "Current workspace",
  );

  $effect(() => {
    const nextSyncKey = `${app.id}:${app.organizationId ?? ""}`;
    if (transferSyncKey === nextSyncKey) return;
    transferSyncKey = nextSyncKey;
    draft = {
      ...app,
      redirectUrisText: app.redirectUrisText,
    };
  });

  async function handleCopy(text: string, field: string) {
    oncopy(text);
    copiedField = field;
    setTimeout(() => (copiedField = null), 1500);
  }

</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div>
    <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Configure {draft.name}</h1>
    <p class="m-0 mt-2 text-[14px] md:text-[16px] text-[#7d7d7d]">Credentials, redirect URLs, and token settings.</p>
  </div>

  <Card>
    <div class="flex flex-col gap-5">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Credentials</h2>
          <p class="m-0 mt-2 text-[14px] text-[#7d7d7d]">Send this client ID with every authorization request.</p>
        </div>
        <Button variant="outline" size="sm" onclick={() => handleCopy(app.clientId, "clientId")}>
          {copiedField === "clientId" ? "Copied" : "Copy client ID"}
        </Button>
      </div>
      <div class="rounded-[22px] bg-white/[0.03] px-5 py-4 font-mono text-[14px] text-[#b9bbbe] break-all">
        {app.clientId}
      </div>
    </div>
  </Card>

  <Card>
    <div class="flex flex-col gap-8">
      <div class="grid gap-6 md:grid-cols-2">
        <label class="flex flex-col gap-3">
          <span class="text-[14px] text-[#8a8a8a]">Application name</span>
          <Input bind:value={draft.name} placeholder="App name" />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-[14px] text-[#8a8a8a]">Description</span>
          <Input bind:value={draft.description} placeholder="Short description" />
        </label>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <label class="flex flex-col gap-3">
          <span class="text-[14px] text-[#8a8a8a]">Website URL</span>
          <Input bind:value={draft.websiteUrl} placeholder="https://" />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-[14px] text-[#8a8a8a]">Icon URL</span>
          <Input bind:value={draft.iconUrl} placeholder="https://" />
        </label>
      </div>

      <label class="flex flex-col gap-3">
        <span class="text-[14px] text-[#8a8a8a]">Redirect URIs</span>
        <Textarea bind:value={draft.redirectUrisText} rows={4} placeholder="https://example.com/callback" />
      </label>

      <div class="flex flex-col gap-2">
        <Toggle bind:checked={draft.developmentMode} label="Development mode" />
        <p class="m-0 text-[13px] text-[#666]">
          Allows localhost, loopback, and Expo Go redirect URLs without listing each one.
        </p>
      </div>

      <div class="flex flex-col gap-4">
        <div>
          <span class="text-[14px] text-[#8a8a8a]">Organization</span>
          <p class="m-0 mt-2 text-[14px] text-[#666]">
            {#if transferPending}
              This app will move from {currentOrganizationName} when you save.
            {:else}
              Move this app to another workspace you belong to.
            {/if}
          </p>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          {#each organizations as organization}
            {@const isSavedCurrent = organization.id === app.organizationId}
            {@const isSelected = organization.id === draft.organizationId}
            {@const isPendingTarget = transferPending && isSelected}
            <button
              class={`rounded-[22px] border-0 px-5 py-4 text-left cursor-pointer transition-all duration-300 ${
                isPendingTarget
                  ? "bg-[#161d18] text-white shadow-[inset_0_0_0_1px_rgba(122,170,135,0.35)]"
                  : isSavedCurrent
                    ? "bg-white/[0.06] text-white"
                    : "bg-white/[0.03] text-white hover:bg-white/[0.055]"
              }`}
              onclick={() => {
                draft.organizationId = organization.id;
              }}
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class={`m-0 truncate text-[15px] font-semibold ${
                    isPendingTarget ? "text-[#eef5ef]" : isSavedCurrent && transferPending ? "text-[#9c9c9c]" : "text-white"
                  }`}>
                    {organization.name}
                  </p>
                  <p class={`m-0 mt-1 text-[13px] ${
                    isPendingTarget ? "text-[#98b39f]" : isSavedCurrent && transferPending ? "text-[#666]" : "text-[#7d7d7d]"
                  }`}>
                    {countLabel(organization.appCount, "app")}
                  </p>
                </div>
                {#if isPendingTarget}
                  <span class="rounded-full bg-[#6fa47f]/14 px-3 py-1 text-[12px] font-medium text-[#bdd3c3]">Will transfer</span>
                {:else if isSavedCurrent}
                  <span class={`rounded-full px-3 py-1 text-[12px] font-medium ${
                    transferPending ? "bg-white/[0.05] text-[#909090]" : "bg-white/[0.1] text-[#c2c2c2]"
                  }`}>Current</span>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>

      <div class="grid gap-6 md:grid-cols-2">
        <label class="flex flex-col gap-3">
          <span class="text-[14px] text-[#8a8a8a]">Access token TTL</span>
          <Input type="number" bind:value={draft.accessTokenTtlSeconds} />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-[14px] text-[#8a8a8a]">Refresh token TTL</span>
          <Input type="number" bind:value={draft.refreshTokenTtlSeconds} />
        </label>
      </div>

      <div class="flex items-center justify-between gap-3 flex-wrap border-t border-white/[0.06] pt-6">
        <div class="flex gap-3 flex-wrap">
          <Button variant="outline" size="sm" onclick={() => onrotate(app.id)} disabled={rotating}>
            {rotating ? "Rotating..." : rotated ? "Rotated" : "Rotate secret"}
          </Button>
          <Button variant="danger" size="sm" onclick={() => ondelete(app)}>Delete app</Button>
        </div>
        <Button
          variant="primary"
          size="sm"
          onclick={() => onsave(draft)}
          disabled={saving}
        >
          {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
        </Button>
      </div>
    </div>
  </Card>
</div>
