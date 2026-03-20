<script lang="ts">
  import Card from "../components/Card.svelte";
  import type { AppEvent, AppIdentityRecord, AppInsightSnapshot, DevApp } from "../lib/api";
  import { formatDateTime, formatPercent, formatRelativeTime, getActivityLabel, getActivityTone } from "../lib/portal";

  interface Props {
    app: DevApp;
    insights: AppInsightSnapshot;
    identities: AppIdentityRecord[];
    events: AppEvent[];
  }

  let { app, insights, identities, events }: Props = $props();

  const highlightedIdentities = $derived(
    [...identities]
      .sort((left, right) => new Date(right.lastActive).getTime() - new Date(left.lastActive).getTime())
      .slice(0, 5),
  );

  const recentChanges = $derived(
    events
      .filter((event) => event.action !== "oauth_authorized")
      .slice(0, 4),
  );

  const methodBreakdown = $derived([
    { label: "Passkey", value: insights.methodCounts.passkey },
    { label: "Instant", value: insights.methodCounts.deviceApproval },
    { label: "Fallback", value: insights.methodCounts.trustCode },
    { label: "Unknown", value: insights.methodCounts.unknown },
  ]);
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="flex flex-col gap-2">
      <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">{app.name}</h1>
      <p class="m-0 max-w-[620px] text-[15px] text-[#7e7e7e]">Overview of sign-ins, identities, and recent changes.</p>
    </div>
    <div class="rounded-full bg-white/[0.04] px-4 py-3 text-[13px] text-[#9e9e9e]">
      Created {formatDateTime(app.createdAt)}
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Identities</span>
        <span class="text-[32px] font-black text-white">{insights.totalIdentities}</span>
        <span class="text-[13px] text-[#6f6f6f]">{insights.weeklyAuthorizations} new in the last 7 days</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Instant sign-ins</span>
        <span class="text-[32px] font-black text-white">{formatPercent(insights.instantSignInRate)}</span>
        <span class="text-[13px] text-[#6f6f6f]">Fastest path back into the app</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Active refresh tokens</span>
        <span class="text-[32px] font-black text-white">{insights.activeRefreshTokens}</span>
        <span class="text-[13px] text-[#6f6f6f]">{insights.revocations} revoked</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Delegated access</span>
        <span class="text-[32px] font-black text-white">{insights.activeDelegations}</span>
        <span class="text-[13px] text-[#6f6f6f]">{insights.resources} connected resources</span>
      </div>
    </Card>
  </div>

  <div class="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
    <Card>
      <div class="flex flex-col gap-5">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Sign-in methods</h2>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#7d7d7d]">A quick read on how people are getting back in.</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          {#each methodBreakdown as item}
            <div class="rounded-[22px] bg-white/[0.03] px-5 py-5">
              <p class="m-0 text-[13px] text-[#666]">{item.label}</p>
              <p class="m-0 mt-2 text-[24px] font-semibold text-white">{item.value}</p>
            </div>
          {/each}
        </div>

        <div class="rounded-[22px] bg-white/[0.03] px-5 py-5">
          <p class="m-0 text-[13px] text-[#666]">Token lifetime</p>
          <div class="mt-3 flex flex-wrap gap-6">
            <div>
              <p class="m-0 text-[22px] font-semibold text-white">{Math.round(app.accessTokenTtlSeconds / 60)} min</p>
              <p class="m-0 pt-1 text-[13px] text-[#7d7d7d]">Access token</p>
            </div>
            <div>
              <p class="m-0 text-[22px] font-semibold text-white">{Math.round(app.refreshTokenTtlSeconds / 86400)} days</p>
              <p class="m-0 pt-1 text-[13px] text-[#7d7d7d]">Refresh token</p>
            </div>
          </div>
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex flex-col gap-5">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Recently active identities</h2>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#7d7d7d]">The identities using this app most recently.</p>
        </div>

        <div class="flex flex-col gap-3">
          {#if highlightedIdentities.length}
            {#each highlightedIdentities as identity}
              <div class="flex items-center justify-between gap-4 rounded-[22px] bg-white/[0.03] px-5 py-4">
                <div class="flex min-w-0 items-center gap-3">
                  {#if identity.avatarUrl}
                    <img src={identity.avatarUrl} alt="" class="h-11 w-11 rounded-full object-cover shrink-0" />
                  {:else}
                    <div class="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05] text-[12px] font-black text-white shrink-0">
                      {identity.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  {/if}
                  <div class="min-w-0">
                    <p class="m-0 truncate text-[15px] font-medium text-white">{identity.displayName}</p>
                    <p class="m-0 pt-1 text-[13px] text-[#7d7d7d]">{identity.signInCount} sign-ins</p>
                  </div>
                </div>
                <span class="shrink-0 text-[13px] text-[#8a8a8a]">{formatRelativeTime(identity.lastActive)}</span>
              </div>
            {/each}
          {:else}
            <div class="rounded-[22px] bg-white/[0.03] px-5 py-8 text-[14px] text-[#7d7d7d]">
              No identity activity yet.
            </div>
          {/if}
        </div>
      </div>
    </Card>
  </div>

  <div class="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
    <Card>
      <div class="flex flex-col gap-5">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Latest changes</h2>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#7d7d7d]">Recent events that changed the app's state.</p>
        </div>

        <div class="flex flex-col gap-3">
          {#if recentChanges.length}
            {#each recentChanges as event}
              <div class="flex items-start justify-between gap-4 rounded-[22px] bg-white/[0.03] px-5 py-4">
                <div class="min-w-0">
                  <p class="m-0 text-[15px] font-medium text-white">{getActivityLabel(event.action)}</p>
                  <p class="m-0 mt-2 text-[13px] text-[#7d7d7d]">{formatDateTime(event.createdAt)}</p>
                </div>
                <span class="shrink-0 rounded-full px-3 py-1.5 text-[12px] {getActivityTone(event.severity)}">
                  {formatRelativeTime(event.createdAt)}
                </span>
              </div>
            {/each}
          {:else}
            <div class="rounded-[22px] bg-white/[0.03] px-5 py-8 text-[14px] text-[#7d7d7d]">
              No recent changes yet.
            </div>
          {/if}
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex flex-col gap-5">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">App setup</h2>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#7d7d7d]">Key details that shape how this app signs people in.</p>
        </div>

        <div class="grid gap-3">
          <div class="rounded-[22px] bg-white/[0.03] px-5 py-4">
            <p class="m-0 text-[13px] text-[#666]">Scopes</p>
            <div class="mt-3 flex flex-wrap gap-2">
              {#each app.allowedScopes as scope}
                <span class="rounded-full bg-white/[0.05] px-3 py-2 text-[13px] text-[#b4b4b4]">{scope}</span>
              {/each}
            </div>
          </div>
          <div class="rounded-[22px] bg-white/[0.03] px-5 py-4">
            <p class="m-0 text-[13px] text-[#666]">Encryption</p>
            <p class="m-0 mt-2 text-[20px] font-semibold text-white">{app.supportsE2ee ? "Enabled" : "Disabled"}</p>
          </div>
          <div class="rounded-[22px] bg-white/[0.03] px-5 py-4">
            <p class="m-0 text-[13px] text-[#666]">Identity coverage</p>
            <p class="m-0 mt-2 text-[20px] font-semibold text-white">{identities.filter((identity) => identity.isPrimary).length} primary identities</p>
            <p class="m-0 mt-1 text-[13px] text-[#7d7d7d]">{identities.length} total rows</p>
          </div>
        </div>
      </div>
    </Card>
  </div>
</div>
