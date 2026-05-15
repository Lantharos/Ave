<script lang="ts">
  import { Plus } from "lucide-svelte";
  import { api } from "../lib/api";
  import { signBusinessAction } from "../lib/business-actions";
  import type { BusinessOrganizationDetail } from "../lib/types";
  import Button from "./Button.svelte";
  import Input from "./Input.svelte";
  import Panel from "./Panel.svelte";
  import SsoConnectionModal from "./SsoConnectionModal.svelte";

  let {
    detail,
    canManageSso,
    busy,
    setBusy,
    setError,
    hasActiveSsoConnection,
    onToggleSsoRequired,
    reload,
  }: {
    detail: BusinessOrganizationDetail;
    canManageSso: boolean;
    busy: boolean;
    setBusy: (value: boolean) => void;
    setError: (value: string) => void;
    hasActiveSsoConnection: boolean;
    onToggleSsoRequired: () => void;
    reload: () => Promise<void>;
  } = $props();

  let domainDraft = $state("");
  let ssoModalOpen = $state(false);

  async function addDomain() {
    if (!domainDraft.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const domain = domainDraft.trim().toLowerCase();
      const signedAction = await signBusinessAction(detail.organization.actingIdentityId, "domain_verification.created", { domain });
      await api.addDomain(detail.organization.id, domain, signedAction);
      domainDraft = "";
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setBusy(false);
    }
  }

  async function verifyDomain(domainId: string, domainName: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const signedAction = await signBusinessAction(detail.organization.actingIdentityId, "domain_verification.verified", { domain: domainName });
      await api.verifyDomain(detail.organization.id, domainId, signedAction);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "DNS verification did not pass");
    } finally {
      setBusy(false);
    }
  }

</script>

<div class="flex flex-col gap-5">
  <div class="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
    <Panel>
      <div class="flex flex-col gap-5">
        <div>
          <h3 class="m-0 text-[24px] font-semibold text-white">Verified domains</h3>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#858585]">Add domains before binding SSO connections to them.</p>
        </div>
        {#if canManageSso}
          <div class="flex gap-3">
            <Input bind:value={domainDraft} placeholder="company.com" />
            <Button onclick={addDomain} disabled={busy || !domainDraft.trim()}>Add</Button>
          </div>
        {/if}
        <div class="grid gap-3">
          {#each detail.domains as domain (domain.id)}
            <div class="rounded-[22px] bg-white/[0.03] px-4 py-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="m-0 text-[15px] font-semibold text-white">{domain.domain}</p>
                {#if domain.status === "verified"}
                  <span class="text-[13px] text-[#75c88a]">verified</span>
                {:else}
                  <Button size="sm" variant="ghost" onclick={() => verifyDomain(domain.id, domain.domain)} disabled={busy}>Verify</Button>
                {/if}
              </div>
              {#if domain.status !== "verified"}
                <p class="m-0 mt-3 break-all rounded-[18px] bg-black/30 px-4 py-3 text-[12px] text-[#9a9a9a]">_ave-challenge.{domain.domain} TXT {domain.token}</p>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </Panel>

    <Panel>
      <div class="flex flex-col gap-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 class="m-0 text-[24px] font-semibold text-white">SSO connections</h3>
            <p class="m-0 mt-2 text-[14px] leading-6 text-[#858585]">Test a connection before requiring it for the org.</p>
          </div>
          {#if canManageSso}
            <Button onclick={() => (ssoModalOpen = true)} disabled={busy}>
              <Plus size={16} />
              <span class="ml-2">New connection</span>
            </Button>
          {/if}
        </div>

        <div class="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-white/[0.03] px-4 py-4">
          <div class="min-w-0">
            <p class="m-0 text-[15px] font-semibold text-white">SSO enforcement</p>
            <p class="m-0 mt-1 text-[13px] leading-6 text-[#858585]">
              {detail.organization.ssoRequired
                ? "Members must use an active SSO connection for this org."
                : hasActiveSsoConnection
                  ? "An active connection can be required when ready."
                  : "Add and test a connection before requiring SSO."}
            </p>
          </div>
          {#if canManageSso}
            <Button
              size="sm"
              variant={detail.organization.ssoRequired ? "ghost" : "primary"}
              onclick={onToggleSsoRequired}
              disabled={busy || (!detail.organization.ssoRequired && !hasActiveSsoConnection)}
            >
              {detail.organization.ssoRequired ? "Make optional" : "Require SSO"}
            </Button>
          {/if}
        </div>

        <div class="grid gap-3">
          {#each detail.ssoConnections as connection (connection.id)}
            <div class="rounded-[22px] bg-white/[0.03] px-4 py-4">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="m-0 truncate text-[15px] font-semibold text-white">{connection.name}</p>
                  <p class="m-0 mt-1 text-[13px] text-[#777]">{connection.provider} · {connection.type}</p>
                </div>
                <span class="text-[13px] text-[#777]">{connection.status}</span>
              </div>
              <p class="m-0 mt-3 text-[13px] leading-6 text-[#858585]">
                {connection.status === "active" ? "Login is active. " : "Login is available after a successful test. "}
                Encrypted keys still require Ave identity grants.
              </p>
              {#if connection.status !== "active"}
                <div class="mt-3">
                  <Button size="sm" variant="ghost" onclick={() => (window.location.href = api.ssoStartUrl(connection.type, connection.id, "test"))}>
                    {connection.type === "oidc" ? "Test OIDC" : "Test SAML"}
                  </Button>
                </div>
              {/if}
              {#if connection.saml}
                <p class="m-0 mt-3 break-all rounded-[18px] bg-black/30 px-4 py-3 text-[12px] text-[#9a9a9a]">{connection.saml.metadataUrl}</p>
              {/if}
            </div>
          {/each}
          {#if !detail.ssoConnections.length}
            <div class="rounded-[22px] bg-white/[0.03] px-4 py-5 text-[14px] text-[#777]">No SSO connections yet.</div>
          {/if}
        </div>
      </div>
    </Panel>
  </div>

  {#if ssoModalOpen}
    <SsoConnectionModal
      {detail}
      {busy}
      {setBusy}
      {setError}
      {reload}
      onClose={() => (ssoModalOpen = false)}
    />
  {/if}
</div>
