<script lang="ts">
  import Card from "../components/Card.svelte";
  import type { AppEvent, AppInsightSnapshot, DevApp } from "../lib/api";
  import { formatDateTime, formatRelativeTime, getActivityLabel, getActivityTone } from "../lib/portal";

  interface Props {
    app: DevApp;
    insights: AppInsightSnapshot;
    events: AppEvent[];
  }

  let { app, insights, events }: Props = $props();
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div class="flex flex-col gap-3">
    <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Activity</h1>
    <p class="m-0 max-w-[720px] text-[15px] md:text-[18px] font-medium text-[#7e7e7e]">
      Real app activity, not a placeholder feed. Authorization history and delegation events are both in here now.
    </p>
  </div>

  <div class="grid gap-4 md:grid-cols-4">
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Passkey</span>
        <span class="text-[34px] font-black text-white">{insights.methodCounts.passkey}</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Device approval</span>
        <span class="text-[34px] font-black text-white">{insights.methodCounts.deviceApproval}</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Trust code</span>
        <span class="text-[34px] font-black text-white">{insights.methodCounts.trustCode}</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Unknown method</span>
        <span class="text-[34px] font-black text-white">{insights.methodCounts.unknown}</span>
      </div>
    </Card>
  </div>

  <Card>
    <div class="flex flex-col gap-5">
      <div>
        <h2 class="m-0 text-[22px] font-semibold text-white">Event stream</h2>
        <p class="m-0 mt-2 text-[14px] leading-6 text-[#7d7d7d]">Most recent auth and delegation events for {app.name}.</p>
      </div>
      <div class="flex flex-col gap-3">
        {#if events.length}
          {#each events as event}
            <div class="flex items-start justify-between gap-4 rounded-[22px] bg-white/[0.03] px-5 py-4">
              <div class="min-w-0">
                <p class="m-0 text-[15px] font-medium text-white">{getActivityLabel(event.action)}</p>
                <p class="m-0 mt-2 text-[13px] text-[#7d7d7d]">{formatDateTime(event.createdAt)} · {event.source}</p>
              </div>
              <span class="rounded-full px-3 py-1.5 text-[12px] {getActivityTone(event.severity)}">
                {formatRelativeTime(event.createdAt)}
              </span>
            </div>
          {/each}
        {:else}
          <div class="rounded-[22px] bg-white/[0.03] px-5 py-8 text-[14px] text-[#7d7d7d]">
            No app activity yet.
          </div>
        {/if}
      </div>
    </div>
  </Card>
</div>
