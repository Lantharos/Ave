<script lang="ts">
  import { RefreshCw } from "@lucide/svelte";
  import { api } from "../lib/api";
  import { signBusinessAction } from "../lib/business-actions";
  import { generateOrgKeyMaterial, wrapOrgKeyForIdentity } from "../lib/crypto";
  import { formatDate } from "../lib/format";
  import type { BusinessKey, BusinessMember, BusinessOrganizationDetail } from "../lib/types";
  import Button from "./Button.svelte";
  import Input from "./Input.svelte";
  import Panel from "./Panel.svelte";

  interface Props {
    detail: BusinessOrganizationDetail;
    canManageKeys: boolean;
    busy: boolean;
    setBusy: (value: boolean) => void;
    setError: (message: string) => void;
    reload: () => Promise<void>;
  }

  type WrappedGrant = {
    identityId: string;
    encryptedKey: string;
    senderPublicKey: string;
    recipientPublicKey: string;
  };

  let { detail, canManageKeys, busy, setBusy, setError, reload }: Props = $props();
  let keyName = $state("");
  let keyResource = $state("");
  const activeMembers = $derived(detail.members.filter((member) => member.status === "active"));
  const policy = $derived(detail.encryptionPolicy);
  const canCreate = $derived(
    canManageKeys
      && !busy
      && Boolean(keyName.trim())
      && (policy.mode !== "enterprise_managed" || Boolean(policy.kmsKeyRef)),
  );

  function keyProviderRef() {
    if (policy.mode === "enterprise_managed") return policy.kmsKeyRef || null;
    if (policy.mode === "standard") return "ave-standard";
    return null;
  }

  async function wrappedGrantsForMembers(members: BusinessMember[]): Promise<WrappedGrant[]> {
    if (policy.mode !== "e2ee") return [];
    const orgKey = generateOrgKeyMaterial();
    const grants: WrappedGrant[] = [];
    for (const member of members.filter((entry) => entry.publicKey)) {
      try {
        const wrapped = await wrapOrgKeyForIdentity(orgKey, member.publicKey!);
        grants.push({ identityId: member.identityId, ...wrapped });
      } catch {
      }
    }
    if (!grants.length) throw new Error("No active organization identities have usable encryption keys.");
    return grants;
  }

  async function createKey() {
    if (!canCreate) return;
    setBusy(true);
    setError("");
    try {
      const grants = await wrappedGrantsForMembers(activeMembers);
      const name = keyName.trim();
      const resource = keyResource.trim() || undefined;
      const details = { name, resource, mode: policy.mode, grants: grants.length, keyProviderRef: keyProviderRef() };
      const signedAction = await signBusinessAction(detail.organization.actingIdentityId, "key.created", details);
      await api.createKey(detail.organization.id, {
        name,
        resource,
        encryptionMode: policy.mode,
        grants,
        signedAction,
      });
      keyName = "";
      keyResource = "";
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization key");
    } finally {
      setBusy(false);
    }
  }

  async function rotateKey(key: BusinessKey) {
    if (!canManageKeys || busy) return;
    setBusy(true);
    setError("");
    try {
      const grants = await wrappedGrantsForMembers(activeMembers);
      const details = {
        keyringId: key.id,
        mode: key.encryptionMode,
        nextEpoch: key.epoch + 1,
        grants: grants.length,
        keyProviderRef: key.keyProviderRef || null,
      };
      const signedAction = await signBusinessAction(detail.organization.actingIdentityId, "key.rotated", details);
      await api.rotateKey(detail.organization.id, key.id, { grants, signedAction });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate organization key");
    } finally {
      setBusy(false);
    }
  }
</script>

<Panel>
  <div class="flex flex-col gap-5">
    <div>
      <h3 class="m-0 text-[22px] font-semibold text-white">Org keys</h3>
      <p class="m-0 mt-2 text-[14px] leading-6 text-[#858585]">
        {policy.mode === "e2ee"
          ? "Keys are generated in this browser and stored only as identity-wrapped grants."
          : policy.mode === "enterprise_managed"
            ? "Org keys follow the configured customer KMS key reference."
            : "Org keys follow standard organization encryption and access policy."}
      </p>
    </div>

    {#if canManageKeys}
      <div class="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <Input bind:value={keyName} placeholder="Key name" />
        <Input bind:value={keyResource} placeholder="Resource, e.g. citadel" />
        <Button onclick={createKey} disabled={!canCreate}>Create</Button>
      </div>
    {/if}

    <div class="grid gap-3">
      {#each detail.keys as key (key.id)}
        <div class="rounded-[14px] bg-[#151515] px-4 py-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="m-0 text-[15px] font-semibold text-white">{key.name}</p>
              <p class="m-0 mt-2 text-[13px] text-[#777]">
                {key.resource || "No resource"} · epoch {key.epoch} · {key.status} · {formatDate(key.createdAt)}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span class="tabular-nums text-[13px] text-[#858585]">{key.grants.filter((grant) => grant.status === "active").length} grants</span>
              {#if canManageKeys && key.status === "active"}
                <Button size="sm" variant="ghost" onclick={() => rotateKey(key)} disabled={busy}>
                  <RefreshCw size={14} />
                  <span class="ml-2">Rotate</span>
                </Button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</Panel>
