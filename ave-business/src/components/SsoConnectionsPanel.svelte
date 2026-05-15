<script lang="ts">
  import type { BusinessSsoConnection } from "../lib/types";
  import Panel from "./Panel.svelte";

  let { connections }: { connections: BusinessSsoConnection[] } = $props();
</script>

<Panel>
  <div class="flex flex-col gap-5">
    <h3 class="m-0 text-[22px] font-semibold text-white">SSO connections</h3>
    <div class="grid gap-3">
      {#each connections as connection (connection.id)}
        <div class="rounded-[22px] bg-white/[0.03] px-4 py-4">
          <div class="flex items-center justify-between gap-3">
            <p class="m-0 text-[15px] font-semibold text-white">{connection.name}</p>
            <span class="text-[13px] text-[#777]">{connection.status}</span>
          </div>
          <p class="m-0 mt-2 text-[13px] leading-6 text-[#858585]">
            {connection.type === "oidc" && connection.status === "active" ? "OIDC login active. " : ""}
            {connection.type === "oidc" && connection.status !== "active" ? "OIDC login is available after a successful test. " : ""}
            {connection.type === "saml" && connection.status === "active" ? "SAML login active. " : ""}
            {connection.type === "saml" && connection.status !== "active" ? "SAML login is available after a successful test. " : ""}
            Encrypted keys still require Ave identity grants.
          </p>
          {#if connection.saml}
            <p class="m-0 mt-3 break-all rounded-[18px] bg-black/30 px-4 py-3 text-[12px] text-[#9a9a9a]">{connection.saml.metadataUrl}</p>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</Panel>
