<script lang="ts">
  import { KeyRound } from "lucide-svelte";
  import { api } from "../lib/api";
  import { signBusinessAction } from "../lib/business-actions";
  import type { BusinessEncryptionMode, BusinessOrganizationDetail, KmsProvider } from "../lib/types";
  import Button from "./Button.svelte";
  import Input from "./Input.svelte";
  import Panel from "./Panel.svelte";
  import Segmented from "./Segmented.svelte";

  interface Props {
    detail: BusinessOrganizationDetail;
    canManageKeys: boolean;
    busy: boolean;
    setBusy: (value: boolean) => void;
    setError: (message: string) => void;
    reload: () => Promise<void>;
  }

  const modeOptions: { value: BusinessEncryptionMode; label: string }[] = [
    { value: "standard", label: "standard" },
    { value: "enterprise_managed", label: "KMS" },
    { value: "e2ee", label: "E2EE" },
  ];
  const providerOptions: { value: KmsProvider; label: string }[] = [
    { value: "aws_kms", label: "AWS" },
    { value: "azure_key_vault", label: "Azure" },
    { value: "gcp_kms", label: "GCP" },
    { value: "external", label: "external" },
  ];

  let { detail, canManageKeys, busy, setBusy, setError, reload }: Props = $props();
  let modeDraft = $derived<BusinessEncryptionMode>(detail.encryptionPolicy.mode);
  let providerDraft = $derived<KmsProvider>(detail.encryptionPolicy.kmsProvider || "aws_kms");
  let keyRefDraft = $derived(detail.encryptionPolicy.kmsKeyRef || "");
  let keyVersionDraft = $derived(detail.encryptionPolicy.kmsKeyVersion || "");

  const canSave = $derived(
    canManageKeys
      && !busy
      && (modeDraft !== "enterprise_managed" || Boolean(keyRefDraft.trim())),
  );

  async function savePolicy() {
    if (!canSave) return;
    setBusy(true);
    setError("");
    try {
      const details = {
        mode: modeDraft,
        kmsProvider: modeDraft === "enterprise_managed" ? providerDraft : null,
        kmsKeyRef: modeDraft === "enterprise_managed" ? keyRefDraft.trim() : null,
        kmsKeyVersion: modeDraft === "enterprise_managed" ? keyVersionDraft.trim() || null : null,
      };
      const signedAction = await signBusinessAction(detail.organization.actingIdentityId, "encryption_policy.updated", details);
      await api.updateEncryptionPolicy(detail.organization.id, {
        mode: modeDraft,
        kmsProvider: modeDraft === "enterprise_managed" ? providerDraft : undefined,
        kmsKeyRef: modeDraft === "enterprise_managed" ? keyRefDraft.trim() : undefined,
        kmsKeyVersion: modeDraft === "enterprise_managed" ? keyVersionDraft.trim() || undefined : undefined,
        signedAction,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update encryption policy");
    } finally {
      setBusy(false);
    }
  }
</script>

<Panel>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h3 class="m-0 text-[22px] font-semibold text-white">Org encryption</h3>
        <p class="m-0 mt-2 max-w-[760px] text-[14px] leading-6 text-[#858585]">
          Standard is seamless. KMS keeps the customer key reference on the org. E2EE uses identity-wrapped grants.
        </p>
      </div>
      <div class="flex min-h-11 items-center gap-2 rounded-full bg-white/[0.04] px-4 text-[13px] text-[#9a9a9a]">
        <KeyRound size={15} />
        <span>{detail.encryptionPolicy.mode === "enterprise_managed" ? "KMS" : detail.encryptionPolicy.mode}</span>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-[auto_1fr_auto] lg:items-end">
      <div>
        <p class="m-0 mb-2 text-[13px] text-[#777]">Mode</p>
        <Segmented value={modeDraft} options={modeOptions} onchange={(value) => (modeDraft = value)} />
      </div>

      {#if modeDraft === "enterprise_managed"}
        <div class="grid gap-3 md:grid-cols-[auto_1fr_0.5fr] md:items-end">
          <div>
            <p class="m-0 mb-2 text-[13px] text-[#777]">Provider</p>
            <Segmented value={providerDraft} options={providerOptions} onchange={(value) => (providerDraft = value)} />
          </div>
          <Input bind:value={keyRefDraft} placeholder="KMS key ARN, Key Vault URL, or Cloud KMS resource" />
          <Input bind:value={keyVersionDraft} placeholder="Version" />
        </div>
      {:else}
        <div class="min-h-11 rounded-[24px] bg-white/[0.03] px-5 py-3 text-[14px] leading-6 text-[#858585]">
          {modeDraft === "e2ee"
            ? "Encrypted resources require identity key enrollment before grants can be issued."
            : "Encrypted resources can follow org SSO and normal access policy without user key setup."}
        </div>
      {/if}

      <Button onclick={savePolicy} disabled={!canSave}>Save</Button>
    </div>
  </div>
</Panel>
