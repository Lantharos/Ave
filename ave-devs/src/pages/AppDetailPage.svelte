<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
  import Input from "../components/Input.svelte";
  import Textarea from "../components/Textarea.svelte";
  import Toggle from "../components/Toggle.svelte";
  import type { DevApp } from "../lib/api";
  import type { WorkspaceSummary } from "../lib/portal";

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
    oncreateResource: (appId: string, resource: {
      resourceKey: string;
      displayName: string;
      description?: string;
      scopes: string[];
      audience: string;
      status: "active" | "disabled";
    }) => Promise<void>;
    ondeleteResource: (appId: string, resourceId: string) => Promise<void>;
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
    oncreateResource,
    ondeleteResource,
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
  let resourceForm = $state({
    resourceKey: "",
    displayName: "",
    description: "",
    scopes: "iris.infer",
    audience: "https://irischat.app/delegated",
    status: "active" as "active" | "disabled",
  });
  let resourceError = $state<string | null>(null);
  let creatingResource = $state(false);
  let deletingResourceId = $state<string | null>(null);
  let transferSyncKey = $state("");

  const transferableOrganizations = $derived.by(() =>
    organizations.filter((organization) => organization.role === "owner" || organization.role === "admin"),
  );
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

  async function handleCreateResource() {
    resourceError = null;

    if (!resourceForm.resourceKey.trim() || !resourceForm.displayName.trim()) {
      resourceError = "Resource key and display name are required.";
      return;
    }

    creatingResource = true;
    try {
      await oncreateResource(app.id, {
        resourceKey: resourceForm.resourceKey.trim(),
        displayName: resourceForm.displayName.trim(),
        description: resourceForm.description.trim() || undefined,
        scopes: resourceForm.scopes.split(" ").map((value) => value.trim()).filter(Boolean),
        audience: resourceForm.audience.trim(),
        status: resourceForm.status,
      });

      resourceForm = {
        resourceKey: "",
        displayName: "",
        description: "",
        scopes: "iris.infer",
        audience: resourceForm.audience,
        status: "active",
      };
    } catch (err) {
      resourceError = err instanceof Error ? err.message : "Failed to create resource";
    } finally {
      creatingResource = false;
    }
  }

  async function handleDeleteResource(resourceId: string) {
    deletingResourceId = resourceId;
    resourceError = null;

    try {
      await ondeleteResource(app.id, resourceId);
    } catch (err) {
      resourceError = err instanceof Error ? err.message : "Failed to delete resource";
    } finally {
      deletingResourceId = null;
    }
  }
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div>
    <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Configure {draft.name}</h1>
    <p class="m-0 mt-2 text-[14px] md:text-[16px] text-[#7d7d7d]">Credentials, redirect URLs, token settings, and connected resources.</p>
  </div>

  <Card>
    <div class="flex flex-col gap-5">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Credentials</h2>
          <p class="m-0 mt-2 text-[14px] text-[#7d7d7d]">Keep the identifiers close without making the screen feel like raw settings soup.</p>
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
              Transfer this app to another workspace where you already have admin access.
            {/if}
          </p>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          {#each transferableOrganizations as organization}
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
                    {organization.role} · {organization.appCount} apps
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

      <div class="flex flex-col gap-4">
        <Toggle bind:checked={draft.supportsE2ee} label="Enable end-to-end encryption" />
        <Toggle bind:checked={draft.allowUserIdScope} label="Allow user_id scope" />
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

  <Card>
    <div class="flex flex-col gap-6">
      <div>
        <h2 class="m-0 text-[22px] font-semibold text-white">Connector resources</h2>
        <p class="m-0 mt-2 text-[14px] text-[#7d7d7d]">Expose brokerable capabilities for delegated Ave flows without hiding them behind another page.</p>
      </div>

      {#if resourceError}
        <div class="rounded-[20px] bg-[#2A1111] px-4 py-3 text-[14px] text-[#E57272]">
          {resourceError}
        </div>
      {/if}

      <div class="grid gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-2">
          <span class="text-[14px] text-[#8a8a8a]">Resource key</span>
          <Input bind:value={resourceForm.resourceKey} placeholder="iris:inference" />
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-[14px] text-[#8a8a8a]">Display name</span>
          <Input bind:value={resourceForm.displayName} placeholder="Iris Inference" />
        </label>
        <label class="flex flex-col gap-2 md:col-span-2">
          <span class="text-[14px] text-[#8a8a8a]">Description</span>
          <Input bind:value={resourceForm.description} placeholder="Delegated inference capability" />
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-[14px] text-[#8a8a8a]">Scopes</span>
          <Input bind:value={resourceForm.scopes} placeholder="iris.infer" />
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-[14px] text-[#8a8a8a]">Audience</span>
          <Input bind:value={resourceForm.audience} placeholder="https://irischat.app/delegated" />
        </label>
      </div>

      <div class="flex justify-end">
        <Button variant="primary" size="sm" onclick={handleCreateResource} disabled={creatingResource}>
          {creatingResource ? "Creating..." : "Add resource"}
        </Button>
      </div>

      <div class="flex flex-col gap-3">
        {#if !(app.resources || []).length}
          <div class="rounded-[22px] bg-white/[0.03] px-4 py-4 text-[14px] text-[#666]">No resources configured yet.</div>
        {/if}

        {#each app.resources || [] as resource}
          <div class="flex items-center justify-between gap-4 rounded-[22px] bg-white/[0.03] px-4 py-4">
            <div class="min-w-0">
              <p class="m-0 text-[15px] font-semibold text-white">{resource.displayName}</p>
              <p class="m-0 mt-1 text-[13px] text-[#7d7d7d]">{resource.resourceKey}</p>
              <p class="m-0 mt-2 text-[13px] text-[#8b8b8b]">{resource.description || "No description provided."}</p>
              <p class="m-0 mt-2 text-[12px] text-[#676767]">Scopes: {resource.scopes.join(", ")} · Audience: {resource.audience}</p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onclick={() => handleDeleteResource(resource.id)}
              disabled={deletingResourceId === resource.id}
            >
              {deletingResourceId === resource.id ? "Deleting..." : "Delete"}
            </Button>
          </div>
        {/each}
      </div>
    </div>
  </Card>
</div>
