<script lang="ts">
  import { onMount } from "svelte";
  import { Building2, ChevronDown, Fingerprint, KeyRound, LockKeyhole, Network, Plus, ScrollText, Upload } from "lucide-svelte";
  import AuroraBackdrop from "$lib/surfaces/business/components/AuroraBackdrop.svelte";
  import Button from "$lib/surfaces/business/components/Button.svelte";
  import AuditPanel from "$lib/surfaces/business/components/AuditPanel.svelte";
  import DomainsSsoPanel from "$lib/surfaces/business/components/DomainsSsoPanel.svelte";
  import EncryptionPanel from "$lib/surfaces/business/components/EncryptionPanel.svelte";
  import IdentitiesPanel from "$lib/surfaces/business/components/IdentitiesPanel.svelte";
  import Input from "$lib/surfaces/business/components/Input.svelte";
  import OrganizationOverview from "$lib/surfaces/business/components/OrganizationOverview.svelte";
  import OrgKeysPanel from "$lib/surfaces/business/components/OrgKeysPanel.svelte";
  import SignInPanel from "$lib/surfaces/business/components/SignInPanel.svelte";
  import { ApiError, api } from "$lib/surfaces/business/lib/api";
  import { scopesForRole, signBusinessAction } from "$lib/surfaces/business/lib/business-actions";
  import { initials } from "$lib/surfaces/business/lib/format";
  import { businessReturnTarget, resolveAveOrigin } from "$lib/surfaces/business/lib/origins";
  import type {
    BusinessIdentity,
    BusinessMember,
    BusinessOrganizationDetail,
    BusinessOrganizationSummary,
    BusinessRole,
  } from "$lib/surfaces/business/lib/types";
  type SectionId = "overview" | "identities" | "keys" | "encryption" | "sso" | "audit";
  const roleOptions: { value: BusinessRole; label: string }[] = [
    { value: "member", label: "member" },
    { value: "signer", label: "signer" },
    { value: "admin", label: "admin" },
    { value: "viewer", label: "viewer" },
  ];
  let identities = $state.raw<BusinessIdentity[]>([]);
  let organizations = $state.raw<BusinessOrganizationSummary[]>([]);
  let selectedOrganizationId = $state<string | null>(null);
  let detail = $state.raw<BusinessOrganizationDetail | null>(null);
  let loading = $state(true);
  let busy = $state(false);
  let authenticated = $state(true);
  let error = $state("");
  let createName = $state("");
  let ownerIdentityId = $state("");
  let addHandle = $state("");
  let addRole = $state<BusinessRole>("member");
  let activeSection = $state<SectionId>("overview");
  let auditLoadedOrganizationId = $state<string | null>(null);
  let organizationOpen = $state(false);
  let createPanelOpen = $state(false);
  let menuRoot = $state<HTMLElement | null>(null);
  let logoInput = $state<HTMLInputElement | null>(null);
  let uploadingLogo = $state(false);
  const activeMembers = $derived(detail?.members.filter((member) => member.status === "active") || []);
  const canManageOrganization = $derived(Boolean(detail?.organization.scopes.includes("manage_org")));
  const canManageIdentities = $derived(Boolean(detail?.organization.scopes.includes("manage_identities")));
  const canManageKeys = $derived(Boolean(detail?.organization.scopes.includes("manage_keys")));
  const canManageSso = $derived(Boolean(detail?.organization.scopes.includes("manage_sso")));
  const hasActiveSsoConnection = $derived(Boolean(detail?.ssoConnections.some((connection) => connection.status === "active")));
  const selectedOrganization = $derived.by(() => organizations.find((organization) => organization.id === selectedOrganizationId) || null);
  const organizationName = $derived(detail?.organization.name || selectedOrganization?.name || "Organizations");
  const organizationMeta = $derived.by(() => {
    if (detail) return `@${detail.organization.actingHandle} · ${detail.organization.role}`;
    if (selectedOrganization) return `@${selectedOrganization.actingHandle} · ${selectedOrganization.role}`;
    return `${organizations.length} organizations`;
  });
  const navItems = $derived([
    { id: "overview" as const, label: "overview", count: "" },
    { id: "identities" as const, label: "identities", count: String(activeMembers.length) },
    { id: "keys" as const, label: "keys", count: String(detail?.keys.length || 0) },
    { id: "encryption" as const, label: "encryption", count: detail?.encryptionPolicy.mode === "enterprise_managed" ? "KMS" : detail?.encryptionPolicy.mode || "" },
    { id: "sso" as const, label: "domains and SSO", count: String((detail?.domains.length || 0) + (detail?.ssoConnections.length || 0)) },
    { id: "audit" as const, label: "audit", count: String(detail?.auditEvents.length || 0) },
  ]);
  onMount(() => {
    void loadBootstrap();

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") organizationOpen = false;
    };

    const handlePointer = (event: PointerEvent) => {
      if (!menuRoot?.contains(event.target as Node)) organizationOpen = false;
    };

    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("pointerdown", handlePointer);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("pointerdown", handlePointer);
    };
  });
  async function loadBootstrap() {
    loading = true;
    error = "";
    try {
      const data = await api.bootstrap();
      authenticated = true;
      identities = data.identities;
      organizations = data.organizations;
      ownerIdentityId = ownerIdentityId || identities.find((identity) => identity.isPrimary)?.id || identities[0]?.id || "";
      if (selectedOrganizationId && organizations.some((organization) => organization.id === selectedOrganizationId)) {
        await loadOrganization(selectedOrganizationId, { includeAudit: false });
      } else {
        selectedOrganizationId = null;
        detail = null;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) authenticated = false;
      else error = err instanceof Error ? err.message : "Failed to load business organizations";
    } finally {
      loading = false;
    }
  }
  async function loadOrganization(organizationId: string, options: { includeAudit?: boolean } = {}) {
    selectedOrganizationId = organizationId;
    error = "";
    try {
      const includeAudit = options.includeAudit ?? activeSection === "audit";
      detail = await api.getOrganization(organizationId, { includeAudit });
      auditLoadedOrganizationId = includeAudit ? organizationId : null;
    } catch (err) {
      selectedOrganizationId = null;
      detail = null;
      error = err instanceof Error ? err.message : "Failed to load organization";
    }
  }
  async function selectOrganization(organizationId: string) {
    auditLoadedOrganizationId = null;
    activeSection = "overview";
    organizationOpen = false;
    createPanelOpen = false;
    await loadOrganization(organizationId, { includeAudit: false });
  }
  async function selectSection(section: SectionId) {
    activeSection = section;
    if (section === "audit" && detail && auditLoadedOrganizationId !== detail.organization.id) {
      await loadOrganization(detail.organization.id, { includeAudit: true });
    }
  }
  async function reloadDetail() {
    if (!detail) return;
    await loadOrganization(detail.organization.id, { includeAudit: activeSection === "audit" || auditLoadedOrganizationId === detail.organization.id });
  }
  async function uploadOrganizationLogo(file: File) {
    if (!detail || uploadingLogo || !canManageOrganization) return;
    const organizationId = detail.organization.id;
    uploadingLogo = true;
    error = "";
    try {
      const result = await api.uploadOrganizationLogo(organizationId, file);
      organizations = organizations.map((organization) => (organization.id === organizationId ? { ...organization, logoUrl: result.logoUrl } : organization));
      if (detail?.organization.id === organizationId) {
        detail = {
          ...detail,
          organization: { ...detail.organization, logoUrl: result.logoUrl },
        };
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to upload organization logo";
    } finally {
      uploadingLogo = false;
    }
  }
  async function createOrganization() {
    if (!createName.trim() || !ownerIdentityId || busy) return;
    busy = true;
    error = "";
    try {
      const name = createName.trim();
      const signedAction = await signBusinessAction(ownerIdentityId, "organization.created", { name, ownerIdentityId });
      const result = await api.createOrganization(name, ownerIdentityId, signedAction);
      createName = "";
      createPanelOpen = false;
      await loadBootstrap();
      activeSection = "overview";
      auditLoadedOrganizationId = null;
      await loadOrganization(result.organization.id, { includeAudit: false });
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create organization";
    } finally {
      busy = false;
    }
  }
  async function addIdentity() {
    if (!detail || !addHandle.trim() || busy) return;
    busy = true;
    error = "";
    try {
      const handle = addHandle.trim().replace(/^@/, "").toLowerCase();
      const signedAction = await signBusinessAction(detail.organization.actingIdentityId, "identity.added", {
        handle,
        role: addRole,
        scopes: scopesForRole(addRole),
      });
      await api.addIdentity(detail.organization.id, { handle, role: addRole, signedAction });
      addHandle = "";
      addRole = "member";
      await loadOrganization(detail.organization.id);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to add identity";
    } finally {
      busy = false;
    }
  }
  async function updateRole(member: BusinessMember, role: BusinessRole) {
    if (!detail || busy || member.role === role) return;
    busy = true;
    error = "";
    try {
      const signedAction = await signBusinessAction(detail.organization.actingIdentityId, "identity.updated", {
        memberId: member.id,
        role,
        scopes: scopesForRole(role, member.scopes),
      });
      await api.updateIdentity(detail.organization.id, member.id, { role, signedAction });
      await loadOrganization(detail.organization.id);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update identity";
    } finally {
      busy = false;
    }
  }
  async function removeMember(member: BusinessMember) {
    if (!detail || busy) return;
    busy = true;
    error = "";
    try {
      const signedAction = await signBusinessAction(detail.organization.actingIdentityId, "identity.removed", { memberId: member.id });
      await api.removeIdentity(detail.organization.id, member.id, signedAction);
      await loadOrganization(detail.organization.id);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to remove identity";
    } finally {
      busy = false;
    }
  }
  async function toggleSsoRequired() {
    if (!detail || busy || (!detail.organization.ssoRequired && !hasActiveSsoConnection)) return;
    busy = true;
    error = "";
    try {
      const ssoRequired = !detail.organization.ssoRequired;
      const signedAction = await signBusinessAction(detail.organization.actingIdentityId, "organization.updated", {
        name: undefined,
        ssoRequired,
      });
      await api.updateOrganization(detail.organization.id, { ssoRequired, signedAction });
      await loadOrganization(detail.organization.id);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update SSO enforcement";
    } finally {
      busy = false;
    }
  }
  function signIn() {
    const loginUrl = new URL("/login", resolveAveOrigin());
    loginUrl.searchParams.set("return_to", businessReturnTarget());
    window.location.href = loginUrl.toString();
  }
</script>

{#if !authenticated}
  <SignInPanel onclick={signIn} />
{:else if detail}
  <main class="relative min-h-screen overflow-x-hidden bg-[#090909] px-3 py-4 text-white md:px-6 md:py-6">
    <AuroraBackdrop preset="business-tr" cclass="opacity-70" mobileHeight={320} />
    <AuroraBackdrop preset="business-bl" cclass="opacity-80" mobileHeight={360} />

    <div class="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <header bind:this={menuRoot} class="relative z-30">
        <input
          bind:this={logoInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          class="hidden"
          onchange={async (event) => {
            const input = event.currentTarget as HTMLInputElement;
            const file = input.files?.[0];
            if (!file) return;
            await uploadOrganizationLogo(file);
            input.value = "";
          }}
        />

        <div class="flex w-full max-w-[480px] items-center gap-2">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={organizationOpen}
            class="flex min-w-0 flex-1 items-center gap-3 rounded-[26px] bg-[#101010]/92 px-3 py-2.5 text-left text-white shadow-[0_18px_50px_rgba(0,0,0,0.26)] backdrop-blur-[18px] transition-[background-color,scale] duration-300 hover:bg-[#151515]/95 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9BBBE]/35 md:px-4 md:py-3"
            onclick={() => (organizationOpen = !organizationOpen)}
          >
            <span class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-[#181818] text-[13px] font-semibold text-[#d4d4d4] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
              {#if detail.organization.logoUrl || selectedOrganization?.logoUrl}
                <img src={detail.organization.logoUrl || selectedOrganization?.logoUrl || ""} alt="" class="h-full w-full object-cover outline outline-1 outline-white/10" />
              {:else}
                {initials(organizationName)}
              {/if}
            </span>
            <span class="flex min-w-0 flex-col leading-none">
              <span class="truncate text-[14px] font-semibold md:text-[15px]">{organizationName}</span>
              <span class="truncate pt-1 text-[12px] text-[#7d7d7d]">{organizationMeta}</span>
            </span>
            <ChevronDown size={16} class="shrink-0 text-[#7d7d7d]" />
          </button>

          {#if canManageOrganization}
            <button
              type="button"
              aria-label="Upload organization logo"
              title={uploadingLogo ? "Uploading logo" : "Upload logo"}
              class="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] bg-[#101010]/92 text-[#b9bbbe] shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-[18px] transition-[background-color,color,scale] duration-300 hover:bg-[#151515]/95 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9BBBE]/35 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={uploadingLogo}
              onclick={() => logoInput?.click()}
            >
              <Upload size={17} class={uploadingLogo ? "animate-pulse" : ""} />
            </button>
          {/if}
        </div>

        {#if organizationOpen}
          <div class="absolute left-0 top-[calc(100%+12px)] z-40 w-full max-w-[560px] rounded-[28px] bg-[#101010] p-3 shadow-[0_30px_120px_rgba(0,0,0,0.55)] md:p-4">
            <div class="hide-scrollbar flex max-h-[360px] flex-col gap-2 overflow-y-auto">
              {#each organizations as org (org.id)}
                <button
                  class="flex items-center justify-between gap-4 rounded-[22px] px-4 py-4 text-left transition-[background-color,scale] duration-300 hover:bg-white/[0.05] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9BBBE]/35 {selectedOrganizationId === org.id ? 'bg-white/[0.07]' : 'bg-transparent'}"
                  onclick={() => selectOrganization(org.id)}
                >
                  <span class="flex min-w-0 items-center gap-3">
                    <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#181818] text-[12px] font-semibold text-[#d4d4d4]">
                      {#if org.logoUrl}
                        <img src={org.logoUrl} alt="" class="h-full w-full rounded-[14px] object-cover" />
                      {:else}
                        {initials(org.name)}
                      {/if}
                    </span>
                    <span class="min-w-0">
                      <span class="block truncate text-[15px] font-semibold text-white">{org.name}</span>
                      <span class="block truncate pt-1 text-[13px] text-[#7d7d7d]">@{org.actingHandle}</span>
                    </span>
                  </span>
                  <span class="shrink-0 text-[12px] text-[#b0b0b0]">{org.role}</span>
                </button>
              {/each}
            </div>

            <div class="mt-3 rounded-[22px] bg-white/[0.03] p-3">
              {#if createPanelOpen}
                <div class="flex flex-col gap-3">
                  <Input bind:value={createName} placeholder="Organization name" />
                  {#if identities.length > 1}
                    <div class="flex flex-col gap-2">
                      {#each identities as identity (identity.id)}
                        <button
                          class="min-h-10 rounded-[14px] px-3.5 text-left text-[13px] transition-[background-color,color,scale] duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9BBBE]/35 {ownerIdentityId === identity.id ? 'bg-[#B9BBBE] font-semibold text-[#090909]' : 'bg-[#151515] text-[#8c8c8c] hover:bg-[#1a1a1a] hover:text-white'}"
                          onclick={() => (ownerIdentityId = identity.id)}
                        >
                          @{identity.handle}
                        </button>
                      {/each}
                    </div>
                  {/if}
                  <Button onclick={createOrganization} disabled={busy || !createName.trim() || !ownerIdentityId}>
                    <Plus size={16} />
                    <span class="ml-2">Create</span>
                  </Button>
                </div>
              {:else}
                <button
                  class="flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] text-[14px] font-semibold text-[#d4d4d4] transition-[background-color,color,scale] duration-200 hover:bg-white/[0.04] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9BBBE]/35"
                  onclick={() => (createPanelOpen = true)}
                >
                  <Plus size={16} />
                  <span>Create new organization</span>
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </header>

      {#if error}
        <div class="flex items-center justify-between gap-4 rounded-[16px] bg-[#241313] px-4 py-3 text-[14px] text-[#E14747]">
          <span>{error}</span>
          <button class="min-h-10 rounded-[12px] px-3 text-[#E14747]/70 transition-colors duration-200 hover:bg-[#301717] hover:text-[#E14747]" onclick={() => (error = "")}>dismiss</button>
        </div>
      {/if}

      <nav class="hide-scrollbar flex gap-2 overflow-x-auto rounded-[18px] bg-[#101010] p-2" aria-label="Organization sections">
        {#each navItems as item (item.id)}
          <button
            class="flex min-h-11 shrink-0 items-center gap-3 rounded-[14px] px-3.5 text-left transition-[background-color,color,scale] duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9BBBE]/35 {activeSection === item.id ? 'bg-[#B9BBBE] text-[#090909]' : 'bg-transparent text-[#8c8c8c] hover:bg-[#181818] hover:text-white'}"
            onclick={() => void selectSection(item.id)}
          >
            {#if item.id === "overview"}
              <Building2 size={15} />
            {:else if item.id === "identities"}
              <Fingerprint size={15} />
            {:else if item.id === "keys"}
              <KeyRound size={15} />
            {:else if item.id === "encryption"}
              <LockKeyhole size={15} />
            {:else if item.id === "sso"}
              <Network size={15} />
            {:else}
              <ScrollText size={15} />
            {/if}
            <span class="truncate text-[14px] font-semibold">{item.label}</span>
            {#if item.count}
              <span class="shrink-0 tabular-nums text-[12px] opacity-60">{item.count}</span>
            {/if}
          </button>
        {/each}
      </nav>

      <section class="flex flex-col gap-5">
        {#if activeSection === "overview"}
          <OrganizationOverview {detail} activeMembers={activeMembers.length} onSelect={(section) => void selectSection(section)} />
        {:else if activeSection === "identities"}
          <IdentitiesPanel
            members={activeMembers}
            bind:addHandle
            bind:addRole
            {roleOptions}
            actingIdentityId={detail.organization.actingIdentityId}
            {canManageIdentities}
            {busy}
            onAdd={addIdentity}
            onRoleChange={updateRole}
            onRemove={removeMember}
          />
        {:else if activeSection === "keys"}
          <OrgKeysPanel
            {detail}
            {canManageKeys}
            {busy}
            setBusy={(value) => (busy = value)}
            setError={(message) => (error = message)}
            reload={reloadDetail}
          />
        {:else if activeSection === "encryption"}
          <EncryptionPanel
            {detail}
            {canManageKeys}
            {busy}
            setBusy={(value) => (busy = value)}
            setError={(message) => (error = message)}
            reload={reloadDetail}
          />
        {:else if activeSection === "sso"}
          <DomainsSsoPanel
            {detail}
            {canManageSso}
            {busy}
            setBusy={(value) => (busy = value)}
            setError={(message) => (error = message)}
            {hasActiveSsoConnection}
            onToggleSsoRequired={toggleSsoRequired}
            reload={reloadDetail}
          />
        {:else}
          <AuditPanel events={detail.auditEvents} />
        {/if}
      </section>
    </div>
  </main>
{:else}
  <main class="relative h-screen overflow-hidden bg-[#090909] p-3 text-white md:p-6">
    <AuroraBackdrop preset="business-tr" cclass="opacity-75" mobileHeight={320} />
    <AuroraBackdrop preset="business-bl" cclass="opacity-90" mobileHeight={360} />

    <section class="relative z-10 flex h-full items-center justify-center">
      <div class="w-full max-w-[560px]">
        {#if error}
          <div class="mb-3 flex items-center justify-between gap-4 rounded-[16px] bg-[#241313] px-4 py-3 text-[14px] text-[#E14747]">
            <span>{error}</span>
            <button class="min-h-10 rounded-[12px] px-3 text-[#E14747]/70 transition-colors duration-200 hover:bg-[#301717] hover:text-[#E14747]" onclick={() => (error = "")}>dismiss</button>
          </div>
        {/if}

        <div class="rounded-[28px] bg-[#101010]/88 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-[18px] md:p-5">
          <div class="px-1 pb-4">
            <h1 class="m-0 text-[26px] font-semibold leading-tight text-white">{organizations.length ? "Choose an organization" : "Create an organization"}</h1>
            <p class="m-0 mt-2 text-[14px] leading-6 text-[#858585]">{organizations.length ? "Pick the business workspace you want to manage." : "Start with a business workspace for identities, keys, and SSO."}</p>
          </div>

          {#if loading}
            <div class="rounded-[22px] bg-[#151515] px-4 py-10 text-center text-[14px] text-[#858585]">Loading organizations...</div>
          {:else}
            {#if organizations.length}
              <div class="hide-scrollbar flex max-h-[360px] flex-col gap-2 overflow-y-auto rounded-[22px] bg-[#151515] p-2">
                {#each organizations as org (org.id)}
                  <button
                    class="flex items-center justify-between gap-4 rounded-[18px] px-4 py-4 text-left transition-[background-color,scale] duration-300 hover:bg-white/[0.05] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9BBBE]/35"
                    onclick={() => selectOrganization(org.id)}
                  >
                    <span class="flex min-w-0 items-center gap-3">
                      <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#1d1d1d] text-[13px] font-semibold text-[#d4d4d4]">
                        {#if org.logoUrl}
                          <img src={org.logoUrl} alt="" class="h-full w-full rounded-[15px] object-cover" />
                        {:else}
                          {initials(org.name)}
                        {/if}
                      </span>
                      <span class="min-w-0">
                        <span class="block truncate text-[15px] font-semibold text-white">{org.name}</span>
                        <span class="block truncate pt-1 text-[13px] text-[#7d7d7d]">@{org.actingHandle}</span>
                      </span>
                    </span>
                    <span class="shrink-0 text-[12px] text-[#b0b0b0]">{org.role}</span>
                  </button>
                {/each}
              </div>
            {/if}

            <div class="mt-3 rounded-[22px] bg-[#151515] p-3">
              {#if createPanelOpen || !organizations.length}
                <div class="flex flex-col gap-3">
                  <Input bind:value={createName} placeholder="Organization name" />
                  {#if identities.length > 1}
                    <div class="flex flex-col gap-2">
                      {#each identities as identity (identity.id)}
                        <button
                          class="min-h-10 rounded-[14px] px-3.5 text-left text-[13px] transition-[background-color,color,scale] duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9BBBE]/35 {ownerIdentityId === identity.id ? 'bg-[#B9BBBE] font-semibold text-[#090909]' : 'bg-[#1d1d1d] text-[#8c8c8c] hover:bg-[#222] hover:text-white'}"
                          onclick={() => (ownerIdentityId = identity.id)}
                        >
                          @{identity.handle}
                        </button>
                      {/each}
                    </div>
                  {/if}
                  <Button onclick={createOrganization} disabled={busy || !createName.trim() || !ownerIdentityId}>
                    <Plus size={16} />
                    <span class="ml-2">Create</span>
                  </Button>
                </div>
              {:else}
                <button
                  class="flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] text-[14px] font-semibold text-[#d4d4d4] transition-[background-color,color,scale] duration-200 hover:bg-white/[0.04] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9BBBE]/35"
                  onclick={() => (createPanelOpen = true)}
                >
                  <Plus size={16} />
                  <span>Create new organization</span>
                </button>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </section>
  </main>
{/if}
