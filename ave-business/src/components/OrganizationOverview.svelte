<script lang="ts">
  import type { BusinessOrganizationDetail } from "../lib/types";
  import Panel from "./Panel.svelte";

  type SectionId = "identities" | "keys" | "encryption" | "sso" | "audit";

  interface Props {
    detail: BusinessOrganizationDetail;
    activeMembers: number;
    onSelect: (section: SectionId) => void;
  }

  let { detail, activeMembers, onSelect }: Props = $props();

  const activeGrants = $derived(detail.keys.reduce((total, key) => total + key.grants.filter((grant) => grant.status === "active").length, 0));
  const verifiedDomains = $derived(detail.domains.filter((domain) => domain.status === "verified").length);
  const activeSso = $derived(detail.ssoConnections.filter((connection) => connection.status === "active").length);
  const encryptionLabel = $derived(detail.encryptionPolicy.mode === "enterprise_managed" ? "KMS" : detail.encryptionPolicy.mode);
</script>

<Panel>
  <div class="flex flex-col gap-6">
    <div>
      <h3 class="m-0 text-[24px] font-semibold text-white">Overview</h3>
      <p class="m-0 mt-2 max-w-[720px] text-[14px] leading-6 text-[#858585]">A quick read on access, encryption, domains, and recent organization activity.</p>
    </div>

    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <button class="summary-tile" onclick={() => onSelect("identities")}>
        <span class="summary-label">Identities</span>
        <span class="summary-value">{activeMembers}</span>
        <span class="summary-note">active members</span>
      </button>
      <button class="summary-tile" onclick={() => onSelect("keys")}>
        <span class="summary-label">Org keys</span>
        <span class="summary-value">{detail.keys.length}</span>
        <span class="summary-note">{activeGrants} active grants</span>
      </button>
      <button class="summary-tile" onclick={() => onSelect("encryption")}>
        <span class="summary-label">Encryption</span>
        <span class="summary-value">{encryptionLabel}</span>
        <span class="summary-note">{detail.encryptionPolicy.status}</span>
      </button>
      <button class="summary-tile" onclick={() => onSelect("sso")}>
        <span class="summary-label">Domains</span>
        <span class="summary-value">{verifiedDomains}</span>
        <span class="summary-note">{activeSso} active SSO</span>
      </button>
      <button class="summary-tile" onclick={() => onSelect("audit")}>
        <span class="summary-label">Audit</span>
        <span class="summary-value">{detail.auditEvents.length}</span>
        <span class="summary-note">signed events</span>
      </button>
      <button class="summary-tile" onclick={() => onSelect("sso")}>
        <span class="summary-label">SSO enforcement</span>
        <span class="summary-value">{detail.organization.ssoRequired ? "required" : "optional"}</span>
        <span class="summary-note">{activeSso ? "connection ready" : "no active connection"}</span>
      </button>
    </div>
  </div>
</Panel>

<style>
  .summary-tile {
    display: flex;
    min-height: 148px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    border: 0;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.03);
    padding: 18px;
    color: inherit;
    text-align: left;
    transition-property: background-color, scale;
    transition-duration: 300ms;
  }

  .summary-tile:hover {
    background: rgba(255, 255, 255, 0.055);
  }

  .summary-tile:active {
    scale: 0.96;
  }

  .summary-label {
    color: #858585;
    font-size: 13px;
  }

  .summary-value {
    max-width: 100%;
    color: #ffffff;
    font-size: 28px;
    font-weight: 800;
    line-height: 1.05;
    overflow-wrap: anywhere;
  }

  .summary-note {
    color: #777777;
    font-size: 13px;
  }
</style>
