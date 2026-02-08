<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
  import { defaultScopes } from "../lib/types";
</script>

<div class="flex flex-col gap-10 md:gap-14">
  <div class="flex flex-col gap-3">
    <h2 class="text-[28px] md:text-[40px] font-black m-0 tracking-tight text-white">Settings</h2>
    <p class="text-[16px] md:text-[20px] text-[#878787] m-0 font-medium">Configure defaults for your developer account.</p>
  </div>

  <div class="grid gap-4 grid-cols-1 sm:grid-cols-2">
    <Card>
      <div class="flex flex-col gap-4">
        <h3 class="text-[18px] md:text-[20px] font-black m-0 text-white">Default scopes</h3>
        <div class="flex flex-wrap gap-2">
          {#each defaultScopes as scope}
            <span class="text-[13px] md:text-[14px] text-[#878787] bg-white/[0.06] px-4 py-2 rounded-full font-mono">{scope}</span>
          {/each}
        </div>
        <div class="pt-2">
          <Button variant="outline" size="sm" onclick={() => {}}>Edit defaults</Button>
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex flex-col gap-4">
        <h3 class="text-[18px] md:text-[20px] font-black m-0 text-white">Notifications</h3>
        <p class="text-[14px] md:text-[16px] text-[#878787] m-0 leading-relaxed font-medium">Control security alerts for credential changes and app updates.</p>
        <div class="pt-2">
          <Button variant="outline" size="sm" onclick={() => {}}>Configure</Button>
        </div>
      </div>
    </Card>
  </div>
</div>
