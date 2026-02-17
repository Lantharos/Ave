<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
  import Input from "../components/Input.svelte";
  import Textarea from "../components/Textarea.svelte";
  import Toggle from "../components/Toggle.svelte";
import type { DevApp } from "../lib/api";

  interface Props {
    app: DevApp & { redirectUrisText?: string };
    onsave: () => void;
    onrotate: (appId: string) => void;
    ondelete: (app: DevApp) => void;
    onback: () => void;
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
    onsave,
    onrotate,
    ondelete,
    onback,
    oncopy,
    oncreateResource,
    ondeleteResource,
    saving,
    saved,
    rotating,
    rotated,
  }: Props = $props();

  let copiedField = $state<string | null>(null);
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
        scopes: resourceForm.scopes.split(" ").map((s) => s.trim()).filter(Boolean),
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
    } catch (e: any) {
      resourceError = e?.message || "Failed to create resource";
    } finally {
      creatingResource = false;
    }
  }

  async function handleDeleteResource(resourceId: string) {
    deletingResourceId = resourceId;
    resourceError = null;
    try {
      await ondeleteResource(app.id, resourceId);
    } catch (e: any) {
      resourceError = e?.message || "Failed to delete resource";
    } finally {
      deletingResourceId = null;
    }
  }
</script>

<div class="flex flex-col gap-10 md:gap-14">
  <div class="flex items-center gap-4">
    <button
      aria-label="Go back"
      class="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/[0.06] flex items-center justify-center border-0 cursor-pointer hover:bg-[#202020] transition-colors duration-300"
      onclick={onback}
    >
      <svg class="w-5 h-5 text-[#878787]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <h2 class="text-[28px] md:text-[40px] font-black m-0 tracking-tight text-white">{app.name}</h2>
  </div>

  <Card>
    <div class="flex flex-col gap-4">
      <div class="flex justify-between items-center">
        <span class="text-[14px] md:text-[16px] text-[#878787] font-black uppercase tracking-wider">Client ID</span>
        <button
          class="text-[14px] text-[#878787] hover:text-white px-4 py-2 rounded-full hover:bg-[#202020] transition-colors duration-300 border-0 bg-transparent cursor-pointer font-medium"
          onclick={() => handleCopy(app.clientId, "clientId")}
        >
          {copiedField === "clientId" ? "Copied" : "Copy"}
        </button>
      </div>
      <code class="text-[14px] md:text-[16px] text-[#B9BBBE] font-mono bg-[#090909]/50 rounded-full px-6 py-3 select-all break-all">{app.clientId}</code>
    </div>
  </Card>

  <Card>
    <div class="flex flex-col gap-6 md:gap-8">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">App name</span>
          <Input bind:value={app.name} placeholder="App name" />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Description</span>
          <Input bind:value={app.description} placeholder="Description" />
        </label>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Website URL</span>
          <Input bind:value={app.websiteUrl} placeholder="https://" />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Icon URL</span>
          <Input bind:value={app.iconUrl} placeholder="https://" />
        </label>
      </div>

      <label class="flex flex-col gap-3">
        <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Redirect URIs</span>
        <span class="text-[13px] md:text-[14px] text-[#878787]/60">One per line</span>
        <Textarea bind:value={app.redirectUrisText} rows={3} />
      </label>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Access token TTL (seconds)</span>
          <Input type="number" bind:value={app.accessTokenTtlSeconds} />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Refresh token TTL (seconds)</span>
          <Input type="number" bind:value={app.refreshTokenTtlSeconds} />
        </label>
      </div>

      <div class="flex flex-col gap-5 pt-2">
        <Toggle bind:checked={app.supportsE2ee} label="Enable end-to-end encryption" />
        <Toggle bind:checked={app.allowUserIdScope} label="Allow user_id scope" />
      </div>
    </div>

    <div class="flex justify-between items-center pt-8 mt-4 border-t border-white/[0.06]">
      <div class="flex gap-3">
        <Button variant="outline" size="sm" onclick={() => onrotate(app.id)} disabled={rotating}>
          {rotating ? "Rotating..." : rotated ? "Rotated" : "Rotate secret"}
        </Button>
        <Button variant="danger" size="sm" onclick={() => ondelete(app)}>Delete</Button>
      </div>
      <Button variant="primary" onclick={onsave} disabled={saving}>
        {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
      </Button>
    </div>
  </Card>

  <Card>
    <div class="flex flex-col gap-6">
      <div>
        <h3 class="text-[22px] font-black m-0 text-white">Connector Resources</h3>
        <p class="text-[#878787] mt-2 text-[14px]">Expose brokerable capabilities for Ave Connector flows.</p>
      </div>

      {#if resourceError}
        <div class="bg-[#2A1111] border border-[#4A2222] rounded-[14px] px-4 py-3 text-[#E57272] text-[14px]">
          {resourceError}
        </div>
      {/if}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="flex flex-col gap-2">
          <span class="text-[14px] text-[#878787]">Resource key</span>
          <Input bind:value={resourceForm.resourceKey} placeholder="iris:inference" />
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-[14px] text-[#878787]">Display name</span>
          <Input bind:value={resourceForm.displayName} placeholder="Iris Inference" />
        </label>
        <label class="flex flex-col gap-2 md:col-span-2">
          <span class="text-[14px] text-[#878787]">Description</span>
          <Input bind:value={resourceForm.description} placeholder="Delegated inference capability" />
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-[14px] text-[#878787]">Scopes (space separated)</span>
          <Input bind:value={resourceForm.scopes} placeholder="iris.infer" />
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-[14px] text-[#878787]">Audience</span>
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
          <div class="text-[#666] text-[14px]">No resources configured yet.</div>
        {/if}
        {#each app.resources || [] as resource}
          <div class="rounded-[14px] border border-white/[0.06] bg-[#0F0F0F] px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p class="text-white font-semibold">{resource.displayName} <span class="text-[#7E7E7E] font-normal">({resource.resourceKey})</span></p>
              <p class="text-[#8A8A8A] text-[13px] mt-1">{resource.description || "No description"}</p>
              <p class="text-[#707070] text-[12px] mt-1">scopes: {resource.scopes.join(", ")} · aud: {resource.audience}</p>
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
