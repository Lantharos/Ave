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

    <div class="grid gap-4 xl:grid-cols-[1fr_0.82fr]">
      <div class="overview-list">
        <button class="overview-row" onclick={() => onSelect("identities")}>
          <span>
            <span class="row-title">Identities</span>
            <span class="row-note">active members</span>
          </span>
          <span class="row-value">{activeMembers}</span>
        </button>
        <button class="overview-row" onclick={() => onSelect("keys")}>
          <span>
            <span class="row-title">Org keys</span>
            <span class="row-note">{activeGrants} active grants</span>
          </span>
          <span class="row-value">{detail.keys.length}</span>
        </button>
        <button class="overview-row" onclick={() => onSelect("encryption")}>
          <span>
            <span class="row-title">Encryption</span>
            <span class="row-note">{detail.encryptionPolicy.status}</span>
          </span>
          <span class="row-value text-value">{encryptionLabel}</span>
        </button>
      </div>

      <div class="overview-list">
        <button class="overview-row" onclick={() => onSelect("sso")}>
          <span>
            <span class="row-title">Domains</span>
            <span class="row-note">{activeSso} active SSO</span>
          </span>
          <span class="row-value">{verifiedDomains}</span>
        </button>
        <button class="overview-row" onclick={() => onSelect("sso")}>
          <span>
            <span class="row-title">SSO enforcement</span>
            <span class="row-note">{activeSso ? "connection ready" : "no active connection"}</span>
          </span>
          <span class="row-value text-value">{detail.organization.ssoRequired ? "required" : "optional"}</span>
        </button>
        <button class="overview-row" onclick={() => onSelect("audit")}>
          <span>
            <span class="row-title">Audit</span>
            <span class="row-note">signed events</span>
          </span>
          <span class="row-value">{detail.auditEvents.length}</span>
        </button>
      </div>
    </div>
  </div>
</Panel>

<style>
  .overview-list {
    display: grid;
    gap: 8px;
    border-radius: 26px;
    background: rgba(255, 255, 255, 0.025);
    padding: 8px;
  }

  .overview-row {
    display: flex;
    min-height: 76px;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    border: 0;
    border-radius: 20px;
    background: transparent;
    padding: 15px 16px;
    color: inherit;
    text-align: left;
    transition-property: background-color, scale;
    transition-duration: 300ms;
  }

  .overview-row:hover {
    background: rgba(255, 255, 255, 0.055);
  }

  .overview-row:active {
    scale: 0.96;
  }

  .row-title,
  .row-note {
    display: block;
  }

  .row-title {
    color: #ffffff;
    font-size: 15px;
    font-weight: 700;
  }

  .row-note {
    margin-top: 5px;
    color: #777777;
    font-size: 13px;
  }

  .row-value {
    max-width: 46%;
    color: #ffffff;
    font-size: 26px;
    font-weight: 800;
    line-height: 1;
    overflow-wrap: anywhere;
    text-align: right;
  }

  .text-value {
    font-size: 18px;
  }
</style>
