<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
  import { defaultScopes } from "../lib/types";
</script>

<div class="flex flex-col gap-6">
  <div>
    <h2 class="text-xl font-semibold m-0 mb-1">Settings</h2>
    <p class="text-[14px] text-[#888] m-0">Configure defaults for your developer account.</p>
  </div>

  <div class="grid gap-4 grid-cols-1 sm:grid-cols-2">
    <Card>
      <div class="flex flex-col gap-3">
        <div class="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
          <svg class="w-5 h-5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 class="text-[15px] font-semibold m-0">Default scopes</h3>
        <div class="flex flex-wrap gap-1.5">
          {#each defaultScopes as scope}
            <span class="text-[11px] text-[#999] bg-white/[0.06] px-2.5 py-1 rounded-full font-mono">{scope}</span>
          {/each}
        </div>
        <div class="pt-2">
          <Button variant="outline" size="sm" onclick={() => {}}>Edit defaults</Button>
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex flex-col gap-3">
        <div class="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
          <svg class="w-5 h-5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <h3 class="text-[15px] font-semibold m-0">Notifications</h3>
        <p class="text-[13px] text-[#888] m-0 leading-relaxed">Control security alerts for credential changes and app updates.</p>
        <div class="pt-2">
          <Button variant="outline" size="sm" onclick={() => {}}>Configure</Button>
        </div>
      </div>
    </Card>
  </div>
</div>
