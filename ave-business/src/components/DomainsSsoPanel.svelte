<script lang="ts">
  import { api } from "../lib/api";
  import { signBusinessAction } from "../lib/business-actions";
  import type { BusinessOrganizationDetail } from "../lib/types";
  import Button from "./Button.svelte";
  import Input from "./Input.svelte";
  import Panel from "./Panel.svelte";
  import Segmented from "./Segmented.svelte";

  type SsoPreset = {
    id: string;
    label: string;
    type: "saml" | "oidc";
    provider: string;
    name: string;
    note: string;
    oidc?: {
      issuer?: string;
      authorizationEndpoint?: string;
      tokenEndpoint?: string;
      jwksUri?: string;
      issuerPlaceholder?: string;
      authorizationPlaceholder?: string;
      tokenPlaceholder?: string;
      jwksPlaceholder?: string;
    };
    saml?: {
      ssoUrlPlaceholder: string;
      entityIdPlaceholder: string;
    };
  };

  const ssoPresets: SsoPreset[] = [
    {
      id: "google_workspace",
      label: "Google Workspace",
      type: "oidc",
      provider: "google_workspace",
      name: "Google Workspace",
      note: "Uses Google's standard OpenID Connect endpoints.",
      oidc: {
        issuer: "https://accounts.google.com",
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
        jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
      },
    },
    {
      id: "okta",
      label: "Okta",
      type: "oidc",
      provider: "okta",
      name: "Okta",
      note: "Use the issuer from your Okta authorization server.",
      oidc: {
        issuerPlaceholder: "https://your-org.okta.com/oauth2/default",
        authorizationPlaceholder: "https://your-org.okta.com/oauth2/default/v1/authorize",
        tokenPlaceholder: "https://your-org.okta.com/oauth2/default/v1/token",
        jwksPlaceholder: "https://your-org.okta.com/oauth2/default/v1/keys",
      },
    },
    {
      id: "microsoft_entra",
      label: "Microsoft Entra ID",
      type: "oidc",
      provider: "microsoft_entra",
      name: "Microsoft Entra ID",
      note: "Use a tenant-specific v2.0 issuer.",
      oidc: {
        issuerPlaceholder: "https://login.microsoftonline.com/{tenant}/v2.0",
        authorizationPlaceholder: "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
        tokenPlaceholder: "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        jwksPlaceholder: "https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys",
      },
    },
    {
      id: "onelogin_saml",
      label: "OneLogin",
      type: "saml",
      provider: "onelogin",
      name: "OneLogin",
      note: "Paste the SAML issuer, SSO URL, and certificate from OneLogin.",
      saml: {
        ssoUrlPlaceholder: "OneLogin SAML 2.0 endpoint",
        entityIdPlaceholder: "OneLogin issuer URL",
      },
    },
    {
      id: "ping_saml",
      label: "Ping Identity",
      type: "saml",
      provider: "ping_identity",
      name: "Ping Identity",
      note: "Paste the SAML app metadata from Ping.",
      saml: {
        ssoUrlPlaceholder: "Ping SSO service URL",
        entityIdPlaceholder: "Ping entity ID",
      },
    },
    {
      id: "generic_oidc",
      label: "Generic OIDC",
      type: "oidc",
      provider: "generic",
      name: "OIDC connection",
      note: "Use any OpenID Connect provider.",
      oidc: {
        issuerPlaceholder: "Issuer URL",
        authorizationPlaceholder: "Authorize URL",
        tokenPlaceholder: "Token URL",
        jwksPlaceholder: "JWKS URL",
      },
    },
    {
      id: "generic_saml",
      label: "Generic SAML",
      type: "saml",
      provider: "generic",
      name: "SAML connection",
      note: "Use any SAML 2.0 identity provider.",
      saml: {
        ssoUrlPlaceholder: "IdP SSO URL",
        entityIdPlaceholder: "IdP entity ID",
      },
    },
  ];

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
  let selectedPresetId = $state("generic_oidc");

  const selectedPreset = $derived(ssoPresets.find((preset) => preset.id === selectedPresetId) || ssoPresets[5]);

  function applyPreset(preset: SsoPreset) {
    selectedPresetId = preset.id;
    ssoType = preset.type;
    ssoProvider = preset.provider;
    ssoName = preset.name;

    if (preset.type === "oidc") {
      oidcIssuer = preset.oidc?.issuer || "";
      oidcAuthorizationEndpoint = preset.oidc?.authorizationEndpoint || "";
      oidcTokenEndpoint = preset.oidc?.tokenEndpoint || "";
      oidcJwksUri = preset.oidc?.jwksUri || "";
      ssoUrl = "";
      ssoEntityId = "";
      ssoCertificate = "";
      return;
    }

    oidcIssuer = "";
    oidcAuthorizationEndpoint = "";
    oidcTokenEndpoint = "";
    oidcJwksUri = "";
    oidcClientId = "";
    oidcClientSecret = "";
  }

  function setSsoType(value: "saml" | "oidc") {
    ssoType = value;
    applyPreset(ssoPresets.find((preset) => preset.id === (value === "oidc" ? "generic_oidc" : "generic_saml"))!);
  }

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
      selectedPresetId = "generic_oidc";
      ssoProvider = "generic";
      ssoType = "oidc";
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
        <div>
          <h3 class="m-0 text-[24px] font-semibold text-white">SSO connections</h3>
          <p class="m-0 mt-2 text-[14px] leading-6 text-[#858585]">Test a connection before requiring it for the org.</p>
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

  {#if canManageSso}
    <Panel>
      <div class="flex flex-col gap-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 class="m-0 text-[24px] font-semibold text-white">New SSO connection</h3>
            <p class="m-0 mt-2 max-w-[720px] text-[14px] leading-6 text-[#858585]">{selectedPreset.note}</p>
          </div>
          <Segmented value={ssoType} options={[{ value: "oidc", label: "oidc" }, { value: "saml", label: "saml" }]} onchange={setSsoType} />
        </div>

        <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {#each ssoPresets as preset (preset.id)}
            <button
              class="min-h-20 rounded-[22px] px-4 py-3 text-left transition-[background-color,color,scale] duration-300 active:scale-[0.96] {selectedPresetId === preset.id ? 'bg-[#B9BBBE] text-[#090909]' : 'bg-white/[0.03] text-[#8f8f8f] hover:bg-white/[0.055] hover:text-white'}"
              onclick={() => applyPreset(preset)}
            >
              <span class="block text-[14px] font-black">{preset.label}</span>
              <span class="mt-2 block text-[12px] opacity-65">{preset.type}</span>
            </button>
          {/each}
        </div>

        <div class="grid gap-3 xl:grid-cols-[1fr_1fr]">
          <Input bind:value={ssoName} placeholder={ssoType === "oidc" ? "OIDC connection name" : "SAML connection name"} />
          <Input bind:value={ssoDomain} placeholder="Verified domain" />
        </div>

        {#if ssoType === "oidc"}
          <div class="grid gap-3">
            <Input bind:value={oidcIssuer} placeholder={selectedPreset.oidc?.issuerPlaceholder || "Issuer URL"} />
            <div class="grid gap-3 xl:grid-cols-3">
              <Input bind:value={oidcAuthorizationEndpoint} placeholder={selectedPreset.oidc?.authorizationPlaceholder || "Authorize URL"} />
              <Input bind:value={oidcTokenEndpoint} placeholder={selectedPreset.oidc?.tokenPlaceholder || "Token URL"} />
              <Input bind:value={oidcJwksUri} placeholder={selectedPreset.oidc?.jwksPlaceholder || "JWKS URL"} />
            </div>
            <div class="grid gap-3 xl:grid-cols-2">
              <Input bind:value={oidcClientId} placeholder="Client ID" />
              <Input bind:value={oidcClientSecret} type="password" placeholder="Client secret" />
            </div>
          </div>
        {:else}
          <div class="grid gap-3">
            <Input bind:value={ssoUrl} placeholder={selectedPreset.saml?.ssoUrlPlaceholder || "IdP SSO URL"} />
            <Input bind:value={ssoEntityId} placeholder={selectedPreset.saml?.entityIdPlaceholder || "IdP entity ID"} />
            <textarea bind:value={ssoCertificate} placeholder="X.509 certificate" class="min-h-28 w-full resize-y rounded-[24px] bg-white/[0.04] px-5 py-4 text-[14px] text-white outline-none transition-colors duration-300 placeholder:text-[#555] focus:bg-white/[0.07]"></textarea>
          </div>
        {/if}

        <div class="flex justify-end">
          <Button onclick={createSsoConnection} disabled={busy || !ssoName.trim()}>{ssoType === "oidc" ? "Save OIDC setup" : "Save SAML setup"}</Button>
        </div>
      </div>
    </Panel>
  {/if}
</div>
