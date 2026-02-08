<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
  import Input from "../components/Input.svelte";
  import Textarea from "../components/Textarea.svelte";
  import Toggle from "../components/Toggle.svelte";
  import { defaultScopes } from "../lib/types";

  interface Props {
    oncreate: (form: FormData) => void;
    oncancel: () => void;
    creating: boolean;
  }

  interface FormData {
    name: string;
    description: string;
    websiteUrl: string;
    iconUrl: string;
    redirectUris: string;
    supportsE2ee: boolean;
    allowUserIdScope: boolean;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
    allowedScopes: string[];
  }

  let { oncreate, oncancel, creating }: Props = $props();

  let form = $state<FormData>({
    name: "",
    description: "",
    websiteUrl: "",
    iconUrl: "",
    redirectUris: "",
    supportsE2ee: false,
    allowUserIdScope: true,
    accessTokenTtlSeconds: 3600,
    refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
    allowedScopes: [...defaultScopes],
  });

  let canSubmit = $derived(form.name.length >= 2 && form.redirectUris.trim().length > 0);
</script>

<div class="flex flex-col gap-10 md:gap-14">
  <div class="flex justify-between items-start gap-4 flex-wrap">
    <div class="flex flex-col gap-3">
      <h2 class="text-[28px] md:text-[40px] font-black m-0 tracking-tight text-white">Create app</h2>
      <p class="text-[16px] md:text-[20px] text-[#878787] m-0 font-medium">Configure redirect URIs, scopes, and token lifetimes.</p>
    </div>
    <Button variant="ghost" size="sm" onclick={oncancel}>Cancel</Button>
  </div>

  <Card>
    <div class="flex flex-col gap-6 md:gap-8">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">App name</span>
          <Input bind:value={form.name} placeholder="My App" />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Description</span>
          <Input bind:value={form.description} placeholder="Short description" />
        </label>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Website URL</span>
          <Input bind:value={form.websiteUrl} placeholder="https://example.com" />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Icon URL</span>
          <Input bind:value={form.iconUrl} placeholder="https://example.com/icon.png" />
        </label>
      </div>

      <label class="flex flex-col gap-3">
        <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Redirect URIs</span>
        <span class="text-[13px] md:text-[14px] text-[#878787]/60">One per line</span>
        <Textarea bind:value={form.redirectUris} rows={3} placeholder="https://example.com/callback" />
      </label>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Access token TTL</span>
          <span class="text-[13px] md:text-[14px] text-[#878787]/60">In seconds (default 3600)</span>
          <Input type="number" bind:value={form.accessTokenTtlSeconds} />
        </label>
        <label class="flex flex-col gap-3">
          <span class="text-[14px] md:text-[16px] text-[#878787] font-medium">Refresh token TTL</span>
          <span class="text-[13px] md:text-[14px] text-[#878787]/60">In seconds (default 30 days)</span>
          <Input type="number" bind:value={form.refreshTokenTtlSeconds} />
        </label>
      </div>

      <div class="flex flex-col gap-5 pt-2">
        <Toggle bind:checked={form.supportsE2ee} label="Enable end-to-end encryption" />
        <Toggle bind:checked={form.allowUserIdScope} label="Allow user_id scope" />
      </div>
    </div>

    <div class="flex justify-end pt-8 mt-4 border-t border-white/[0.06]">
      <Button
        variant="primary"
        onclick={() => oncreate(form)}
        disabled={creating || !canSubmit}
      >
        {creating ? "Creating..." : "Create app"}
      </Button>
    </div>
  </Card>
</div>
