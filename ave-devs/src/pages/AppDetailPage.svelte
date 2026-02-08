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
        <Button variant="outline" size="sm" onclick={() => onrotate(app.id)}>Rotate secret</Button>
        <Button variant="danger" size="sm" onclick={() => ondelete(app)}>Delete</Button>
      </div>
      <Button variant="primary" onclick={onsave}>Save changes</Button>
    </div>
  </Card>
</div>
