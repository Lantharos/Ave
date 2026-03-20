<script lang="ts">
  import Card from "../components/Card.svelte";
  import type { AppEvent, AppInsightSnapshot, DevApp } from "../lib/api";
  import { formatDateTime, formatRelativeTime, getActivityLabel, getActivityTone } from "../lib/portal";

  interface Props {
    app: DevApp;
    insights: AppInsightSnapshot;
    events: AppEvent[];
    total: number;
    loadingmore: boolean;
    hasmore: boolean;
    onloadmore: () => void;
  }

  let { app, insights, events, total, loadingmore, hasmore, onloadmore }: Props = $props();

  const actionCounts = $derived(
    Object.entries(
      events.reduce<Record<string, number>>((counts, event) => {
        counts[event.action] = (counts[event.action] || 0) + 1;
        return counts;
      }, {}),
    )
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6),
  );

  const notableEvents = $derived(
    events.filter((event) => event.action !== "authorization_added").slice(0, 8),
  );
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div class="flex flex-col gap-3">
    <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">Activity</h1>
    <p class="m-0 max-w-[560px] text-[15px] text-[#7e7e7e]">Recent sign-in patterns and changes for {app.name}.</p>
    <p class="m-0 text-[13px] text-[#666]">{total} events</p>
  </div>

  <div class="grid gap-4 md:grid-cols-4">
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Total events</span>
        <span class="text-[32px] font-black text-white">{total}</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Passkey</span>
        <span class="text-[32px] font-black text-white">{insights.methodCounts.passkey}</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Instant</span>
        <span class="text-[32px] font-black text-white">{insights.methodCounts.deviceApproval}</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Fallback</span>
        <span class="text-[32px] font-black text-white">{insights.methodCounts.trustCode + insights.methodCounts.unknown}</span>
      </div>
    </Card>
  </div>

  <div class="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
    <Card>
      <div class="flex flex-col gap-5">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Top activity</h2>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#7d7d7d]">What has been happening most often recently.</p>
        </div>

        <div class="flex flex-col gap-3">
          {#if actionCounts.length}
            {#each actionCounts as [action, count]}
              <div class="flex items-center justify-between gap-4 rounded-[22px] bg-white/[0.03] px-5 py-4">
                <span class="text-[15px] font-medium text-white">{getActivityLabel(action)}</span>
                <span class="text-[14px] text-[#8a8a8a]">{count}</span>
              </div>
            {/each}
          {:else}
            <div class="rounded-[22px] bg-white/[0.03] px-5 py-8 text-[14px] text-[#7d7d7d]">
              No activity yet.
            </div>
          {/if}
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex flex-col gap-5">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Latest changes</h2>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#7d7d7d]">State-changing events, without the full authorization firehose.</p>
        </div>

        <div class="flex flex-col gap-3">
          {#if notableEvents.length}
            {#each notableEvents as event}
              <div class="flex items-start justify-between gap-4 rounded-[22px] bg-white/[0.03] px-5 py-4">
                <div class="min-w-0">
                  <p class="m-0 text-[15px] font-medium text-white">{getActivityLabel(event.action)}</p>
                  <p class="m-0 mt-2 text-[13px] text-[#7d7d7d]">{formatDateTime(event.createdAt)}</p>
                </div>
                <span class="rounded-full px-3 py-1.5 text-[12px] {getActivityTone(event.severity)}">
                  {formatRelativeTime(event.createdAt)}
                </span>
              </div>
            {/each}
          {:else}
            <div class="rounded-[22px] bg-white/[0.03] px-5 py-8 text-[14px] text-[#7d7d7d]">
              No changes yet.
            </div>
          {/if}
        </div>

        {#if hasmore}
          <button
            class="mt-2 rounded-full border-0 bg-white/[0.04] px-5 py-3 text-[14px] text-[#c2c2c2] cursor-pointer transition-colors duration-300 hover:bg-white/[0.07] disabled:opacity-50 disabled:pointer-events-none"
            onclick={onloadmore}
            disabled={loadingmore}
          >
            {loadingmore ? "Loading more..." : "Load more"}
          </button>
        {/if}
      </div>
    </Card>
  </div>
</div>
