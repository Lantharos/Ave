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
    { label: "Total apps", value: apps.length },
    { label: "Redirect URIs", value: apps.reduce((sum, app) => sum + app.redirectUris.length, 0) },
    { label: "E2EE enabled", value: apps.filter((app) => app.supportsE2ee).length },
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

<div class="flex flex-col gap-10 md:gap-14">
  <header class="flex justify-between items-start gap-6 flex-wrap">
    <div class="flex flex-col gap-3">
      <h1 class="text-[28px] md:text-[40px] font-black m-0 tracking-tight text-white leading-tight">Build with Ave identity.</h1>
      <p class="text-[16px] md:text-[20px] text-[#878787] m-0 max-w-lg font-medium">Manage OAuth + OIDC apps, credentials, and security posture from one place.</p>
    </div>
    <div class="flex gap-3 flex-wrap">
      <Button variant="ghost" size="sm" onclick={() => window.open("https://aveid.net/docs", "_blank")}>Docs</Button>
      <Button variant="primary" size="sm" onclick={oncreate}>Create app</Button>
    </div>
  </header>

  <section class="grid gap-4 grid-cols-1 sm:grid-cols-3">
    {#each stats as stat}
      <Card>
        <div class="flex flex-col gap-2">
          <p class="text-[14px] md:text-[16px] text-[#878787] m-0 font-medium">{stat.label}</p>
          <p class="text-[32px] md:text-[40px] font-black m-0 text-white">{stat.value}</p>
        </div>
      </Card>
    {/each}
  </section>

  <section class="flex flex-col gap-6">
    <h2 class="text-[24px] font-black m-0 text-[#878787]">QUICK START</h2>
    <div class="grid gap-4 grid-cols-1 sm:grid-cols-3">
      {#each quickStarts as item}
        <Card>
          <div class="flex flex-col gap-3">
            <h3 class="text-[18px] md:text-[20px] font-black m-0 text-white">{item.title}</h3>
            <p class="text-[14px] md:text-[16px] text-[#878787] m-0 leading-relaxed font-medium">{item.description}</p>
            <div class="pt-2">
              <Button variant="outline" size="sm" onclick={() => window.open(item.href, "_blank")}>View guide</Button>
            </div>
          </div>
        </Card>
      {/each}
    </div>
  </section>

  <section class="flex flex-col gap-6">
    <div class="flex justify-between items-center gap-4 flex-wrap">
      <h2 class="text-[24px] font-black m-0 text-[#878787]">LIVE ENDPOINTS</h2>
      <Button variant="ghost" size="sm" onclick={() => window.open("https://aveid.net/docs#endpoints", "_blank")}>API reference</Button>
    </div>
    <Card>
      <div class="flex flex-col divide-y divide-white/[0.06]">
        {#each endpoints as item}
          <div class="flex justify-between items-center gap-4 py-4 md:py-5">
            <div class="min-w-0">
              <h4 class="text-[16px] md:text-[18px] font-medium m-0 mb-1 text-white">{item.title}</h4>
              <p class="text-[13px] md:text-[14px] text-[#878787] m-0 truncate font-mono">{item.url}</p>
            </div>
            <button
              class="text-[14px] text-[#878787] hover:text-white px-4 py-2 rounded-full hover:bg-[#202020] transition-colors duration-300 border-0 bg-transparent cursor-pointer font-medium shrink-0"
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
