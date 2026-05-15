<script lang="ts">
  import { actionLabel, formatDate } from "../lib/format";
  import type { BusinessAuditEvent } from "../lib/types";
  import Panel from "./Panel.svelte";

  let { events }: { events: BusinessAuditEvent[] } = $props();
</script>

<Panel>
  <div class="flex flex-col gap-4">
    <h3 class="m-0 text-[22px] font-semibold text-white">Audit</h3>
    <div class="grid gap-2">
      {#each events as event (event.id)}
        <div class="grid gap-3 rounded-[20px] bg-white/[0.03] px-4 py-3 md:grid-cols-[1fr_auto_auto]">
          <span class="text-[14px] text-white">{actionLabel(event.action)}</span>
          <span class="text-[13px] text-[#777]">{event.signatureStatus}</span>
          <span class="text-[13px] text-[#777]">{formatDate(event.createdAt)}</span>
        </div>
      {/each}
    </div>
  </div>
</Panel>
