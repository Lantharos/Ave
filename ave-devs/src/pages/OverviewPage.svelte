<script lang="ts">
  import Button from "../components/Button.svelte";
  import Card from "../components/Card.svelte";
  import type { DevApp } from "../lib/api";

  interface Props {
    apps: DevApp[];
    oncreate: () => void;
  }

  let { apps, oncreate }: Props = $props();

  const stats = $derived([
    { label: "Total apps", value: apps.length, icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { label: "Redirect URIs", value: apps.reduce((sum, app) => sum + app.redirectUris.length, 0), icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
    { label: "E2EE enabled", value: apps.filter((app) => app.supportsE2ee).length, icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
  ]);

  const quickStarts = [
    {
      title: "Web apps (PKCE)",
      description: "SPA-friendly OAuth + OIDC with the Ave SDK.",
      href: "https://aveid.net/docs#pkce",
    },
    {
      title: "Server apps",
      description: "Exchange tokens server-side with client secret.",
      href: "https://aveid.net/docs#endpoints",
    },
    {
      title: "Embed sign-in",
      description: "Drop in the Ave iframe widget with postMessage.",
      href: "https://aveid.net/docs#sdks",
    },
  ];

  const endpoints = [
    { title: "OIDC Discovery", url: "https://api.aveid.net/.well-known/openid-configuration" },
    { title: "JWKS", url: "https://api.aveid.net/.well-known/jwks.json" },
    { title: "Token Endpoint", url: "https://api.aveid.net/api/oauth/token" },
    { title: "Userinfo", url: "https://api.aveid.net/api/oauth/userinfo" },
  ];

  let copiedUrl = $state<string | null>(null);

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    copiedUrl = url;
    setTimeout(() => (copiedUrl = null), 1500);
  }
</script>

<div class="flex flex-col gap-8">
  <header class="flex justify-between items-start gap-6 flex-wrap">
    <div>
      <p class="uppercase tracking-[0.2em] text-[#555] text-[11px] font-medium m-0 mb-2">Developer Portal</p>
      <h1 class="text-[clamp(26px,3vw,38px)] font-bold m-0 mb-2 tracking-tight">Build with Ave identity.</h1>
      <p class="text-[15px] text-[#888] m-0 max-w-md">Manage OAuth + OIDC apps, credentials, and security posture from one place.</p>
    </div>
    <div class="flex gap-3 flex-wrap mt-3">
      <Button variant="ghost" size="sm" onclick={() => window.open("https://aveid.net/docs", "_blank")}>Docs</Button>
      <Button variant="primary" size="sm" onclick={oncreate}>Create app</Button>
    </div>
  </header>

  <section class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(160px,1fr))]">
    {#each stats as stat}
      <Card>
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
            <svg class="w-4.5 h-4.5 text-[#888]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d={stat.icon} />
            </svg>
          </div>
          <div>
            <p class="text-[12px] text-[#666] m-0 mb-1 font-medium">{stat.label}</p>
            <p class="text-2xl font-bold m-0 text-white">{stat.value}</p>
          </div>
        </div>
      </Card>
    {/each}
  </section>

  <section>
    <h2 class="text-lg font-semibold m-0 mb-4">Quick start</h2>
    <div class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
      {#each quickStarts as item}
        <Card>
          <h3 class="text-[15px] font-semibold m-0 mb-2">{item.title}</h3>
          <p class="text-[13px] text-[#888] m-0 mb-4 leading-relaxed">{item.description}</p>
          <Button variant="outline" size="sm" onclick={() => window.open(item.href, "_blank")}>View guide</Button>
        </Card>
      {/each}
    </div>
  </section>

  <section>
    <Card tone="soft">
      <div class="flex justify-between items-start gap-4 flex-wrap mb-5">
        <div>
          <h2 class="text-lg font-semibold m-0 mb-1">Live endpoints</h2>
          <p class="text-[13px] text-[#888] m-0">Current Ave OIDC endpoints and key sets.</p>
        </div>
        <Button variant="ghost" size="sm" onclick={() => window.open("https://aveid.net/docs#endpoints", "_blank")}>API reference</Button>
      </div>
      <div class="flex flex-col divide-y divide-white/[0.06]">
        {#each endpoints as item}
          <div class="flex justify-between items-center gap-4 py-3.5">
            <div class="min-w-0">
              <h4 class="text-sm font-medium m-0 mb-0.5">{item.title}</h4>
              <p class="text-[12px] text-[#666] m-0 truncate font-mono">{item.url}</p>
            </div>
            <button
              class="text-[12px] text-[#888] hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/[0.06] transition-all duration-200 border-0 bg-transparent cursor-pointer font-medium shrink-0"
              onclick={() => copyUrl(item.url)}
            >
              {copiedUrl === item.url ? "Copied" : "Copy"}
            </button>
          </div>
        {/each}
      </div>
    </Card>
  </section>
</div>
