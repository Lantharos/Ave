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
  }

  let { app = $bindable(), onsave, onrotate, ondelete, onback, oncopy }: Props = $props();

  let copiedField = $state<string | null>(null);

  async function handleCopy(text: string, field: string) {
    oncopy(text);
    copiedField = field;
    setTimeout(() => (copiedField = null), 1500);
  }
</script>

<div class="flex flex-col gap-6 max-w-2xl">
  <div class="flex items-center gap-3 mb-2">
    <button
      class="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center border-0 cursor-pointer hover:bg-white/[0.1] transition-colors"
      onclick={onback}
    >
      <svg class="w-4 h-4 text-[#999]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <h2 class="text-xl font-semibold m-0">{app.name}</h2>
  </div>

  <Card tone="soft">
    <div class="flex flex-col gap-3">
      <div class="flex justify-between items-center">
        <span class="text-[12px] text-[#666] font-medium uppercase tracking-wider">Client ID</span>
        <button
          class="text-[12px] text-[#888] hover:text-white px-2 py-1 rounded-md hover:bg-white/[0.06] transition-all border-0 bg-transparent cursor-pointer"
          onclick={() => handleCopy(app.clientId, "clientId")}
        >
          {copiedField === "clientId" ? "Copied" : "Copy"}
        </button>
      </div>
      <code class="text-[13px] text-[#ccc] font-mono bg-black/30 rounded-lg px-3 py-2 select-all break-all">{app.clientId}</code>
    </div>
  </Card>

  <Card>
    <div class="flex flex-col gap-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label class="flex flex-col gap-2">
          <span class="text-[13px] text-[#999] font-medium">App name</span>
          <Input bind:value={app.name} placeholder="App name" />
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-[13px] text-[#999] font-medium">Description</span>
          <Input bind:value={app.description} placeholder="Description" />
        </label>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label class="flex flex-col gap-2">
          <span class="text-[13px] text-[#999] font-medium">Website URL</span>
          <Input bind:value={app.websiteUrl} placeholder="https://" />
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-[13px] text-[#999] font-medium">Icon URL</span>
          <Input bind:value={app.iconUrl} placeholder="https://" />
        </label>
      </div>

      <label class="flex flex-col gap-2">
        <span class="text-[13px] text-[#999] font-medium">Redirect URIs</span>
        <span class="text-[12px] text-[#555]">One per line</span>
        <Textarea bind:value={app.redirectUrisText} rows={3} />
      </label>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label class="flex flex-col gap-2">
          <span class="text-[13px] text-[#999] font-medium">Access token TTL (seconds)</span>
          <Input type="number" bind:value={app.accessTokenTtlSeconds} />
        </label>
        <label class="flex flex-col gap-2">
          <span class="text-[13px] text-[#999] font-medium">Refresh token TTL (seconds)</span>
          <Input type="number" bind:value={app.refreshTokenTtlSeconds} />
        </label>
      </div>

      <div class="flex flex-col gap-4 pt-2">
        <Toggle bind:checked={app.supportsE2ee} label="Enable end-to-end encryption" />
        <Toggle bind:checked={app.allowUserIdScope} label="Allow user_id scope" />
      </div>
    </div>

    <div class="flex justify-between items-center pt-6 mt-2 border-t border-white/[0.06]">
      <div class="flex gap-2">
        <Button variant="outline" size="sm" onclick={() => onrotate(app.id)}>Rotate secret</Button>
        <Button variant="danger" size="sm" onclick={() => ondelete(app)}>Delete</Button>
      </div>
      <Button variant="primary" onclick={onsave}>Save changes</Button>
    </div>
  </Card>
</div>
