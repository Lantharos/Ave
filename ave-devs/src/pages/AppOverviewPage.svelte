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

  const recentEvents = $derived(events.slice(0, 6));
  const insightCopy = $derived([
    insights.instantSignInRate >= 70
      ? `Instant sign-ins are at ${formatPercent(insights.instantSignInRate)}, which gives the app a strong “it just works” proof point.`
      : `Instant sign-ins are only ${formatPercent(insights.instantSignInRate)} right now, so passkey and trusted-device coverage still has room to grow.`,
    insights.redirectSecurityRate === 100
      ? "Every redirect URI is HTTPS, so the redirect surface is in a healthy state."
      : "Some redirect URIs still are not HTTPS, which weakens the trust story more than it should.",
    app.supportsE2ee
      ? "End-to-end encryption is enabled, which keeps the app aligned with Ave’s strongest product story."
      : "End-to-end encryption is still off, so the app is missing one of Ave’s clearest differentiators.",
  ]);
</script>

<div class="flex flex-col gap-8 md:gap-10">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="flex flex-col gap-3">
      <h1 class="m-0 text-[30px] md:text-[40px] font-black tracking-tight text-white">{app.name}</h1>
      <p class="m-0 max-w-[760px] text-[15px] md:text-[18px] font-medium text-[#7e7e7e]">
        The control panel view: authorization volume, identity coverage, sign-in quality, and the configuration details developers look for when they want to trust the integration.
      </p>
    </div>
    <div class="rounded-full bg-white/[0.04] px-4 py-3 text-[13px] text-[#9e9e9e]">
      Created {formatDateTime(app.createdAt)}
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Authorized identities</span>
        <span class="text-[34px] font-black text-white">{insights.totalIdentities}</span>
        <span class="text-[13px] text-[#6f6f6f]">{insights.weeklyAuthorizations} new authorizations in 7 days</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Instant sign-ins</span>
        <span class="text-[34px] font-black text-white">{formatPercent(insights.instantSignInRate)}</span>
        <span class="text-[13px] text-[#6f6f6f]">{insights.methodCounts.passkey + insights.methodCounts.deviceApproval} low-friction auth events</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Active refresh tokens</span>
        <span class="text-[34px] font-black text-white">{insights.activeRefreshTokens}</span>
        <span class="text-[13px] text-[#6f6f6f]">{insights.revocations} revocations recorded</span>
      </div>
    </Card>
    <Card>
      <div class="flex flex-col gap-2">
        <span class="text-[14px] text-[#7d7d7d]">Connector resources</span>
        <span class="text-[34px] font-black text-white">{insights.resources}</span>
        <span class="text-[13px] text-[#6f6f6f]">{insights.activeDelegations} active delegations</span>
      </div>
    </Card>
  </div>

  <div class="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
    <Card>
      <div class="flex flex-col gap-5">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Insights</h2>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#7d7d7d]">This is the layer that makes Ave’s identity model legible instead of mystical.</p>
        </div>
        <div class="grid gap-3">
          {#each insightCopy as item}
            <div class="rounded-[22px] bg-white/[0.03] px-5 py-4 text-[14px] leading-6 text-[#b3b3b3]">
              {item}
            </div>
          {/each}
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex flex-col gap-5">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Configuration snapshot</h2>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#7d7d7d]">Quick answers for the usual developer questions: what’s enabled, what’s trusted, and where traffic returns.</p>
        </div>
        <div class="grid gap-3">
          <div class="rounded-[22px] bg-white/[0.03] px-5 py-4">
            <p class="m-0 text-[13px] text-[#666]">Redirect hygiene</p>
            <p class="m-0 mt-2 text-[20px] font-semibold text-white">{formatPercent(insights.redirectSecurityRate)}</p>
            <p class="m-0 mt-1 text-[13px] text-[#7d7d7d]">{app.redirectUris.length} redirect URIs</p>
          </div>
          <div class="rounded-[22px] bg-white/[0.03] px-5 py-4">
            <p class="m-0 text-[13px] text-[#666]">Identity coverage</p>
            <p class="m-0 mt-2 text-[20px] font-semibold text-white">{identities.length} rows</p>
            <p class="m-0 mt-1 text-[13px] text-[#7d7d7d]">{identities.filter((identity) => identity.isPrimary).length} primary identities</p>
          </div>
          <div class="rounded-[22px] bg-white/[0.03] px-5 py-4">
            <p class="m-0 text-[13px] text-[#666]">Token policy</p>
            <p class="m-0 mt-2 text-[20px] font-semibold text-white">{Math.round(app.accessTokenTtlSeconds / 60)} min access</p>
            <p class="m-0 mt-1 text-[13px] text-[#7d7d7d]">{Math.round(app.refreshTokenTtlSeconds / 86400)} day refresh window</p>
          </div>
        </div>
      </div>
    </Card>
  </div>

  <div class="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
    <Card>
      <div class="flex flex-col gap-5">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Recent activity</h2>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#7d7d7d]">Authorization and delegation events tied directly to this app.</p>
        </div>
        <div class="flex flex-col gap-3">
          {#if recentEvents.length}
            {#each recentEvents as event}
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
              No app-specific activity yet.
            </div>
          {/if}
        </div>
      </div>
    </Card>

    <Card>
      <div class="flex flex-col gap-5">
        <div>
          <h2 class="m-0 text-[22px] font-semibold text-white">Scope and connector surface</h2>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#7d7d7d]">A readable audit of what the app can request and where it sends traffic.</p>
        </div>

        <div class="flex flex-wrap gap-2">
          {#each app.allowedScopes as scope}
            <span class="rounded-full bg-white/[0.04] px-3 py-2 text-[13px] text-[#b4b4b4]">{scope}</span>
          {/each}
        </div>

        <div class="flex flex-col gap-3">
          {#each app.redirectUris as uri}
            <div class="rounded-[20px] bg-white/[0.03] px-4 py-4 text-[13px] text-[#8a8a8a] break-all">
              {uri}
            </div>
          {/each}
        </div>
      </div>
    </Card>
  </div>
</div>
