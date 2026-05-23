<script lang="ts">
  import { X } from "@lucide/svelte";
  import { api } from "../lib/api";
  import { signBusinessAction } from "../lib/business-actions";
  import type { BusinessOrganizationDetail } from "../lib/types";
  import Button from "./Button.svelte";
  import Input from "./Input.svelte";
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
    busy,
    setBusy,
    setError,
    reload,
    onClose,
  }: {
    detail: BusinessOrganizationDetail;
    busy: boolean;
    setBusy: (value: boolean) => void;
    setError: (value: string) => void;
    reload: () => Promise<void>;
    onClose: () => void;
  } = $props();

  let ssoType = $state<"saml" | "oidc">("oidc");
  let ssoName = $state("OIDC connection");
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
    const preset = ssoPresets.find((item) => item.id === (value === "oidc" ? "generic_oidc" : "generic_saml"));
    if (preset) applyPreset(preset);
  }

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === "Escape" && !busy) onClose();
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
      await reload();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save SSO connection");
    } finally {
      setBusy(false);
    }
  }
</script>

<svelte:window onkeydown={closeOnEscape} />

<div class="fixed inset-0 z-50">
  <button class="absolute inset-0 bg-black/70 backdrop-blur-sm" onclick={onClose} disabled={busy} aria-label="Close SSO setup"></button>
  <div class="relative z-10 flex min-h-full items-center justify-center px-3 py-6">
    <div
      class="max-h-[calc(100vh-48px)] w-full max-w-[980px] overflow-y-auto rounded-[18px] bg-[#101010] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_32px_100px_rgba(0,0,0,0.42)] md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sso-modal-title"
    >
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="sso-modal-title" class="m-0 text-[24px] font-semibold text-white">New SSO connection</h3>
          <p class="m-0 mt-2 max-w-[620px] text-[14px] leading-6 text-[#858585]">{selectedPreset.note}</p>
        </div>
        <div class="flex items-center gap-3">
          <Segmented value={ssoType} options={[{ value: "oidc", label: "oidc" }, { value: "saml", label: "saml" }]} onchange={setSsoType} />
          <button
            class="flex min-h-10 w-10 items-center justify-center rounded-[12px] bg-[#181818] text-[#8c8c8c] transition-[background-color,color,scale] duration-200 hover:bg-[#202020] hover:text-white active:scale-[0.96]"
            onclick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div class="mt-6 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {#each ssoPresets as preset (preset.id)}
          <button
            class="min-h-20 rounded-[14px] px-4 py-3 text-left transition-[background-color,color,scale] duration-200 active:scale-[0.96] {selectedPresetId === preset.id ? 'bg-[#B9BBBE] text-[#090909]' : 'bg-[#151515] text-[#8f8f8f] hover:bg-[#1d1d1d] hover:text-white'}"
            onclick={() => applyPreset(preset)}
          >
            <span class="block text-[14px] font-semibold">{preset.label}</span>
            <span class="mt-2 block text-[12px] opacity-65">{preset.type}</span>
          </button>
        {/each}
      </div>

      <div class="mt-6 grid gap-3 xl:grid-cols-[1fr_0.85fr]">
        <Input bind:value={ssoName} placeholder={ssoType === "oidc" ? "OIDC connection name" : "SAML connection name"} />
        <Input bind:value={ssoDomain} placeholder="Verified domain" />
      </div>

      {#if ssoType === "oidc"}
        <div class="mt-3 grid gap-3">
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
        <div class="mt-3 grid gap-3">
          <Input bind:value={ssoUrl} placeholder={selectedPreset.saml?.ssoUrlPlaceholder || "IdP SSO URL"} />
          <Input bind:value={ssoEntityId} placeholder={selectedPreset.saml?.entityIdPlaceholder || "IdP entity ID"} />
          <textarea
            bind:value={ssoCertificate}
            placeholder="X.509 certificate"
            class="min-h-28 w-full resize-y rounded-[14px] bg-[#181818] px-4 py-4 text-[14px] text-white outline-none transition-[background-color,box-shadow] duration-200 placeholder:text-[#5f5f5f] focus:bg-[#202020] focus:shadow-[0_0_0_2px_rgba(185,187,190,0.18)]"
          ></textarea>
        </div>
      {/if}

      <div class="mt-6 flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onclick={onClose} disabled={busy}>Cancel</Button>
        <Button onclick={createSsoConnection} disabled={busy || !ssoName.trim()}>{ssoType === "oidc" ? "Save OIDC setup" : "Save SAML setup"}</Button>
      </div>
    </div>
  </div>
</div>
