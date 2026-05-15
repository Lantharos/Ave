<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-svelte";
  import AuroraBackdrop from "./components/AuroraBackdrop.svelte";
  import Button from "./components/Button.svelte";
  import AuditPanel from "./components/AuditPanel.svelte";
  import DomainsSsoPanel from "./components/DomainsSsoPanel.svelte";
  import EncryptionPanel from "./components/EncryptionPanel.svelte";
  import Input from "./components/Input.svelte";
  import OrgKeysPanel from "./components/OrgKeysPanel.svelte";
  import Panel from "./components/Panel.svelte";
  import Segmented from "./components/Segmented.svelte";
  import SignInPanel from "./components/SignInPanel.svelte";
  import { ApiError, api } from "./lib/api";
  import { scopesForRole, signBusinessAction } from "./lib/business-actions";
  import { initials } from "./lib/format";
  import { businessReturnTarget, resolveAveOrigin } from "./lib/origins";
  import type {
    BusinessIdentity,
    BusinessMember,
    BusinessOrganizationDetail,
    BusinessOrganizationSummary,
    BusinessRole,
  } from "./lib/types";
  const roleOptions: { value: BusinessRole; label: string }[] = [
    { value: "member", label: "member" },
    { value: "signer", label: "signer" },
    { value: "admin", label: "admin" },
    { value: "viewer", label: "viewer" },
  ];
  let identities = $state<BusinessIdentity[]>([]);
  let organizations = $state<BusinessOrganizationSummary[]>([]);
  let selectedOrganizationId = $state<string | null>(null);
  let detail = $state<BusinessOrganizationDetail | null>(null);
  let loading = $state(true);
  let busy = $state(false);
  let authenticated = $state(true);
  let error = $state("");
  let createName = $state("");
  let ownerIdentityId = $state("");
  let addHandle = $state("");
  let addRole = $state<BusinessRole>("member");
  const activeMembers = $derived(detail?.members.filter((member) => member.status === "active") || []);
  const canManageIdentities = $derived(Boolean(detail?.organization.scopes.includes("manage_identities")));
  const canManageKeys = $derived(Boolean(detail?.organization.scopes.includes("manage_keys")));
  const canManageSso = $derived(Boolean(detail?.organization.scopes.includes("manage_sso")));
  const hasActiveSsoConnection = $derived(Boolean(detail?.ssoConnections.some((connection) => connection.status === "active")));
  onMount(() => {
    void loadBootstrap();
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
      selectedOrganizationId = selectedOrganizationId || organizations[0]?.id || null;
      if (selectedOrganizationId) await loadOrganization(selectedOrganizationId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) authenticated = false;
      else error = err instanceof Error ? err.message : "Failed to load business organizations";
    } finally {
      loading = false;
    }
  }
  async function loadOrganization(organizationId: string) {
    selectedOrganizationId = organizationId;
    error = "";
    try {
      detail = await api.getOrganization(organizationId);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load organization";
    }
  }
  async function reloadDetail() {
    if (detail) await loadOrganization(detail.organization.id);
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
      await loadBootstrap();
      await loadOrganization(result.organization.id);
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
{:else}
  <main class="relative min-h-screen overflow-hidden bg-[#090909] px-3 py-3 md:px-5 md:py-5">
    <AuroraBackdrop preset="business-tr" cclass="absolute top-0 right-0 w-[70%] pointer-events-none select-none" />
    <AuroraBackdrop preset="business-bl" cclass="absolute bottom-0 left-0 w-[80%] pointer-events-none select-none" />

    <div class="relative z-10 mx-auto flex w-full max-w-[1440px] flex-col gap-5">
      <header class="rounded-[30px] bg-[#0d0d0d]/88 px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="m-0 text-[14px] text-[#7d7d7d]">business.aveid.net</p>
            <h1 class="m-0 mt-1 text-[30px] font-black text-white md:text-[42px]">Organizations</h1>
          </div>
          <Button variant="ghost" onclick={loadBootstrap} disabled={loading}>
            <RefreshCw size={16} />
            <span class="ml-2">Refresh</span>
          </Button>
        </div>
      </header>

      {#if error}
        <div class="flex items-center justify-between gap-4 rounded-full bg-[#E14747]/10 px-5 py-3 text-[14px] text-[#E14747]">
          <span>{error}</span>
          <button class="min-h-10 rounded-full px-3 text-[#E14747]/70 hover:text-[#E14747]" onclick={() => (error = "")}>dismiss</button>
        </div>
      {/if}

      <div class="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside class="flex flex-col gap-4">
          <Panel>
            <div class="flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <h2 class="m-0 text-[18px] font-semibold text-white">Your orgs</h2>
                <span class="tabular-nums text-[13px] text-[#707070]">{organizations.length}</span>
              </div>
              <div class="flex flex-col gap-2">
                {#each organizations as org (org.id)}
                  <button
                    class="flex min-h-14 items-center justify-between gap-3 rounded-[20px] px-4 text-left transition-[background-color,scale] duration-300 active:scale-[0.96] {selectedOrganizationId === org.id ? 'bg-white/[0.08]' : 'bg-white/[0.03] hover:bg-white/[0.05]'}"
                    onclick={() => loadOrganization(org.id)}
                  >
                    <span class="min-w-0">
                      <span class="block truncate text-[14px] font-semibold text-white">{org.name}</span>
                      <span class="block truncate text-[12px] text-[#777]">@{org.actingHandle}</span>
                    </span>
                    <span class="rounded-full bg-white/[0.05] px-3 py-1 text-[12px] text-[#9a9a9a]">{org.role}</span>
                  </button>
                {/each}
              </div>
            </div>
          </Panel>

          <Panel>
            <div class="flex flex-col gap-4">
              <h2 class="m-0 text-[18px] font-semibold text-white">Create organization</h2>
              <Input bind:value={createName} placeholder="Organization name" />
              <div class="flex flex-col gap-2">
                {#each identities as identity (identity.id)}
                  <button
                    class="min-h-11 rounded-full px-4 text-left text-[13px] transition-colors duration-300 {ownerIdentityId === identity.id ? 'bg-[#B9BBBE] font-black text-[#090909]' : 'bg-white/[0.04] text-[#8c8c8c] hover:text-white'}"
                    onclick={() => (ownerIdentityId = identity.id)}
                  >
                    @{identity.handle}
                  </button>
                {/each}
              </div>
              <Button onclick={createOrganization} disabled={busy || !createName.trim() || !ownerIdentityId}>
                <Plus size={16} />
                <span class="ml-2">Create</span>
              </Button>
            </div>
          </Panel>
        </aside>

        {#if detail}
          <section class="flex flex-col gap-5">
            <Panel>
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="m-0 text-[14px] text-[#777]">@{detail.organization.actingHandle} acting in</p>
                  <h2 class="m-0 mt-1 text-[30px] font-black text-white md:text-[40px]">{detail.organization.name}</h2>
                  <p class="m-0 mt-2 max-w-[680px] text-[14px] leading-6 text-[#858585]">Use dedicated identities for each organization when data boundaries matter.</p>
                </div>
                <Button
                  variant={detail.organization.ssoRequired ? "primary" : "ghost"}
                  onclick={toggleSsoRequired}
                  disabled={!canManageSso || busy || (!detail.organization.ssoRequired && !hasActiveSsoConnection)}
                >
                  <ShieldCheck size={16} />
                  <span class="ml-2">{detail.organization.ssoRequired ? "SSO required" : "SSO optional"}</span>
                </Button>
              </div>
            </Panel>

            <div class="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <Panel>
                <div class="flex flex-col gap-5">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <h3 class="m-0 text-[22px] font-semibold text-white">Identities</h3>
                    <span class="tabular-nums text-[13px] text-[#777]">{activeMembers.length} active</span>
                  </div>
                  {#if canManageIdentities}
                    <div class="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                      <Input bind:value={addHandle} placeholder="@handle" />
                      <Segmented value={addRole} options={roleOptions} onchange={(role) => (addRole = role)} />
                      <Button onclick={addIdentity} disabled={busy || !addHandle.trim()}>Add</Button>
                    </div>
                  {/if}
                  <div class="flex flex-col overflow-hidden rounded-[24px] bg-[#0b0b0b]">
                    {#each activeMembers as member (member.id)}
                      <div class="grid gap-4 px-4 py-4 odd:bg-white/[0.02] md:grid-cols-[1fr_auto_auto] md:items-center">
                        <div class="flex min-w-0 items-center gap-3">
                          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-[13px] font-black text-white">
                            {initials(member.displayName)}
                          </div>
                          <div class="min-w-0">
                            <p class="m-0 truncate text-[15px] font-semibold text-white">{member.displayName}</p>
                            <p class="m-0 mt-1 truncate text-[13px] text-[#777]">@{member.handle}{member.hasEncryptionKey ? "" : " · no identity key"}</p>
                          </div>
                        </div>
                        <Segmented value={member.role} options={roleOptions} onchange={(role) => updateRole(member, role)} />
                        <button
                          class="flex min-h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-[#777] transition-colors duration-300 hover:bg-[#E14747]/10 hover:text-[#E14747]"
                          onclick={() => removeMember(member)}
                          aria-label={`Remove ${member.handle}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    {/each}
                  </div>
                </div>
              </Panel>

              <OrgKeysPanel
                {detail}
                {canManageKeys}
                {busy}
                setBusy={(value) => (busy = value)}
                setError={(message) => (error = message)}
                reload={reloadDetail}
              />
            </div>

            <EncryptionPanel
              {detail}
              {canManageKeys}
              {busy}
              setBusy={(value) => (busy = value)}
              setError={(message) => (error = message)}
              reload={reloadDetail}
            />

            <DomainsSsoPanel
              {detail}
              {canManageSso}
              {busy}
              setBusy={(value) => (busy = value)}
              setError={(message) => (error = message)}
              reload={() => (detail ? loadOrganization(detail.organization.id) : Promise.resolve())}
            />

            <AuditPanel events={detail.auditEvents} />
          </section>
        {:else}
          <Panel>
            <div class="py-16 text-center text-[15px] text-[#858585]">{loading ? "Loading..." : "Create an organization to start."}</div>
          </Panel>
        {/if}
      </div>
    </div>
  </main>
{/if}
