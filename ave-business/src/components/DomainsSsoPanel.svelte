<script lang="ts">
  import { api } from "../lib/api";
  import { signBusinessAction } from "../lib/business-actions";
  import type { BusinessOrganizationDetail } from "../lib/types";
  import Button from "./Button.svelte";
  import Input from "./Input.svelte";
  import Panel from "./Panel.svelte";
  import Segmented from "./Segmented.svelte";

  let {
    detail,
    canManageSso,
    busy,
    setBusy,
    setError,
    reload,
  }: {
    detail: BusinessOrganizationDetail;
    canManageSso: boolean;
    busy: boolean;
    setBusy: (value: boolean) => void;
    setError: (value: string) => void;
    reload: () => Promise<void>;
  } = $props();

  let domainDraft = $state("");
  let ssoType = $state<"saml" | "oidc">("oidc");
  let ssoName = $state("");
  let ssoDomain = $state("");
  let ssoProvider = $state("generic");
  let ssoUrl = $state("");
  let ssoEntityId = $state("");
  let ssoCertificate = $state("");
  let oidcIssuer = $state("");
  let oidcAuthorizationEndpoint = $state("");
  let oidcTokenEndpoint = $state("");
  let oidcJwksUri = $state("");
  let oidcClientId = $state("");
  let oidcClientSecret = $state("");

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

  async function createSsoConnection() {
    if (!ssoName.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const name = ssoName.trim();
      const provider = ssoProvider.trim() || "generic";
      const domain = ssoDomain.trim() || undefined;
      const signedAction = await signBusinessAction(detail.organization.actingIdentityId, "sso_connection.created", {
        type: ssoType,
        provider,
        name,
        domain,
      });
      await api.createSsoConnection(detail.organization.id, {
        type: ssoType,
        provider,
        name,
        domain,
        ssoUrl: ssoType === "saml" ? ssoUrl.trim() || undefined : undefined,
        entityId: ssoType === "saml" ? ssoEntityId.trim() || undefined : undefined,
        x509Certificate: ssoType === "saml" ? ssoCertificate.trim() || undefined : undefined,
        issuer: ssoType === "oidc" ? oidcIssuer.trim() || undefined : undefined,
        authorizationEndpoint: ssoType === "oidc" ? oidcAuthorizationEndpoint.trim() || undefined : undefined,
        tokenEndpoint: ssoType === "oidc" ? oidcTokenEndpoint.trim() || undefined : undefined,
        jwksUri: ssoType === "oidc" ? oidcJwksUri.trim() || undefined : undefined,
        clientId: ssoType === "oidc" ? oidcClientId.trim() || undefined : undefined,
        clientSecret: ssoType === "oidc" ? oidcClientSecret.trim() || undefined : undefined,
        signedAction,
      });
      ssoName = "";
      ssoUrl = "";
      ssoEntityId = "";
      ssoCertificate = "";
      oidcIssuer = "";
      oidcAuthorizationEndpoint = "";
      oidcTokenEndpoint = "";
      oidcJwksUri = "";
      oidcClientId = "";
      oidcClientSecret = "";
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save SSO connection");
    } finally {
      setBusy(false);
    }
  }
</script>

<div class="grid gap-5 xl:grid-cols-2">
  <Panel>
    <div class="flex flex-col gap-5">
      <h3 class="m-0 text-[22px] font-semibold text-white">Domains and SSO</h3>
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
      {#if canManageSso}
        <div class="grid gap-3">
          <Segmented value={ssoType} options={[{ value: "oidc", label: "oidc" }, { value: "saml", label: "saml" }]} onchange={(value) => (ssoType = value)} />
          <Input bind:value={ssoName} placeholder={ssoType === "oidc" ? "OIDC connection name" : "SAML connection name"} />
          <div class="grid gap-3 md:grid-cols-2">
            <Input bind:value={ssoDomain} placeholder="Verified domain" />
            <Input bind:value={ssoProvider} placeholder="Provider" />
          </div>
          {#if ssoType === "oidc"}
            <Input bind:value={oidcIssuer} placeholder="Issuer URL" />
            <div class="grid gap-3 md:grid-cols-3">
              <Input bind:value={oidcAuthorizationEndpoint} placeholder="Authorize URL" />
              <Input bind:value={oidcTokenEndpoint} placeholder="Token URL" />
              <Input bind:value={oidcJwksUri} placeholder="JWKS URL" />
            </div>
            <Input bind:value={oidcClientId} placeholder="Client ID" />
            <Input bind:value={oidcClientSecret} placeholder="Client secret" />
          {:else}
            <Input bind:value={ssoUrl} placeholder="IdP SSO URL" />
            <Input bind:value={ssoEntityId} placeholder="IdP entity ID" />
            <textarea bind:value={ssoCertificate} placeholder="X.509 certificate" class="min-h-28 w-full resize-y rounded-[24px] bg-white/[0.04] px-5 py-4 text-[14px] text-white outline-none transition-colors duration-300 placeholder:text-[#555] focus:bg-white/[0.07]"></textarea>
          {/if}
          <Button onclick={createSsoConnection} disabled={busy || !ssoName.trim()}>{ssoType === "oidc" ? "Save OIDC setup" : "Save SAML setup"}</Button>
        </div>
      {/if}
    </div>
  </Panel>

  <Panel>
    <div class="flex flex-col gap-5">
      <h3 class="m-0 text-[22px] font-semibold text-white">SSO connections</h3>
      <div class="grid gap-3">
        {#each detail.ssoConnections as connection (connection.id)}
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
      </div>
    </div>
  </Panel>
</div>
