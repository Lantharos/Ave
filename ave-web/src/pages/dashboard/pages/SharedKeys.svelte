<script lang="ts">
    import ActionCard from "../../../components/ActionCard.svelte";
    import Text from "../../../components/Text.svelte";
    import Spinner from "../../../components/Spinner.svelte";
    import { api } from "../../../lib/api";
    import { createSharedSecretsQuery, queryKeys } from "../../../lib/queries";
    import { queryClient } from "../../../lib/query-client";
    import {
        createStoredIdentityEncryptionKeyPair,
        encrypt,
        encryptSecretForIdentity,
        loadMasterKey,
    } from "../../../lib/crypto";
    import { currentIdentity } from "../../../stores/auth";

    const sharedSecretsQuery = createSharedSecretsQuery();

    let kind = $state<"app_scoped" | "global">("global");
    let label = $state("");
    let appId = $state("");
    let resourceKey = $state("");
    let targetHandle = $state("");
    let secretValue = $state("");
    let returnUrl = $state("");
    let isSubmitting = $state(false);
    let error = $state("");
    let success = $state("");
    let latestClaimUrl = $state("");
    let loading = $derived(sharedSecretsQuery.isPending);

    async function ensureEncryptionKey(identityId: string, masterKey: CryptoKey) {
        const existing = await api.encryption.getKey(identityId);
        if (existing.hasKey && existing.encryptedPrivateKey) {
            return existing;
        }

        const newKey = await createStoredIdentityEncryptionKeyPair(masterKey);
        await api.encryption.createKey(identityId, newKey);
        return {
            hasKey: true,
            publicKey: newKey.publicKey,
            encryptedPrivateKey: newKey.encryptedPrivateKey,
            createdAt: new Date().toISOString(),
        };
    }

    async function handleCreateAndShare() {
        if (!$currentIdentity) {
            error = "Select an identity first.";
            return;
        }

        if (!label.trim() || !targetHandle.trim() || !secretValue.trim()) {
            error = "Label, target handle, and secret are required.";
            return;
        }

        if (kind === "app_scoped" && !appId.trim()) {
            error = "App-scoped secrets need an app ID.";
            return;
        }

        isSubmitting = true;
        error = "";
        success = "";
        latestClaimUrl = "";

        try {
            const masterKey = await loadMasterKey();
            if (!masterKey) {
                throw new Error("Your encryption key is not available on this device.");
            }

            await ensureEncryptionKey($currentIdentity.id, masterKey);

            const ownerEnvelope = await encrypt(secretValue, masterKey);
            const created = await api.sharedSecrets.create({
                identityId: $currentIdentity.id,
                kind,
                appId: kind === "app_scoped" ? appId.trim() : undefined,
                resourceKey: resourceKey.trim() || undefined,
                label: label.trim(),
                encryptedSecret: ownerEnvelope,
            });

            const target = await api.encryption.getPublicKey(targetHandle.trim().toLowerCase());
            const transferPayload = await encryptSecretForIdentity(secretValue, target.publicKey);
            const transfer = await api.sharedSecrets.createTransfer(created.secret.id, {
                identityId: $currentIdentity.id,
                targetHandle: targetHandle.trim().toLowerCase(),
                encryptedSecretForTarget: transferPayload.encryptedSecret,
                senderPublicKey: transferPayload.senderPublicKey,
                returnUrl: returnUrl.trim() || undefined,
            });

            latestClaimUrl = transfer.claimUrl;
            success = `Shared "${label.trim()}" with @${targetHandle.trim().toLowerCase()}.`;
            secretValue = "";
            targetHandle = "";
            label = "";
            appId = "";
            resourceKey = "";
            returnUrl = "";

            await queryClient.invalidateQueries({ queryKey: queryKeys.sharedSecrets });
        } catch (e: any) {
            error = e.message || "Failed to share secret";
        } finally {
            isSubmitting = false;
        }
    }

    async function copyClaimUrl(url: string) {
        await navigator.clipboard.writeText(url);
        success = "Claim link copied.";
    }
</script>

<div class="flex flex-col gap-4 md:gap-[36px] w-full z-10 p-3 md:p-[60px] bg-[#111111]/60 rounded-[24px] md:rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-2">
        <Text type="h" size={40} mobileSize={24} weight="bold">Shared Keys</Text>
        <Text type="p" size={18} mobileSize={14} color="#878787">Create a secret, package it for another Ave handle, and hand them a claim link without exposing plaintext to the server.</Text>
    </div>

    <ActionCard
        action="FOUNDER TRANSFER FLOW"
        description="Ave stores only encrypted envelopes. Your current identity keeps one wrapped copy, and the target handle gets a claimable encrypted copy."
        buttons={[]}
    />

    {#if error}
        <div class="bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-2xl">{error}</div>
    {/if}

    {#if success}
        <div class="bg-[#32A94C]/20 border border-[#32A94C] text-[#32A94C] px-4 py-3 rounded-2xl">{success}</div>
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="flex flex-col gap-2 text-white">
            <span class="text-sm text-[#878787]">Secret Type</span>
            <select bind:value={kind} class="bg-[#171717] border border-[#2A2A2A] rounded-2xl px-4 py-3 text-white">
                <option value="global">Global</option>
                <option value="app_scoped">App Scoped</option>
            </select>
        </label>

        <label class="flex flex-col gap-2 text-white">
            <span class="text-sm text-[#878787]">Target Handle</span>
            <input bind:value={targetHandle} class="bg-[#171717] border border-[#2A2A2A] rounded-2xl px-4 py-3 text-white" placeholder="founder_friend" />
        </label>

        <label class="flex flex-col gap-2 text-white">
            <span class="text-sm text-[#878787]">Label</span>
            <input bind:value={label} class="bg-[#171717] border border-[#2A2A2A] rounded-2xl px-4 py-3 text-white" placeholder="Citadel Vault Root Key" />
        </label>

        <label class="flex flex-col gap-2 text-white">
            <span class="text-sm text-[#878787]">Resource Key</span>
            <input bind:value={resourceKey} class="bg-[#171717] border border-[#2A2A2A] rounded-2xl px-4 py-3 text-white" placeholder="vault.root" />
        </label>

        {#if kind === "app_scoped"}
            <label class="flex flex-col gap-2 text-white md:col-span-2">
                <span class="text-sm text-[#878787]">App ID</span>
                <input bind:value={appId} class="bg-[#171717] border border-[#2A2A2A] rounded-2xl px-4 py-3 text-white" placeholder="OAuth app UUID" />
            </label>
        {/if}

        <label class="flex flex-col gap-2 text-white md:col-span-2">
            <span class="text-sm text-[#878787]">Secret Value</span>
            <textarea bind:value={secretValue} class="bg-[#171717] border border-[#2A2A2A] rounded-2xl px-4 py-3 text-white min-h-[140px]" placeholder="Paste the plaintext secret or serialized key payload here"></textarea>
        </label>

        <label class="flex flex-col gap-2 text-white md:col-span-2">
            <span class="text-sm text-[#878787]">Return URL</span>
            <input bind:value={returnUrl} class="bg-[#171717] border border-[#2A2A2A] rounded-2xl px-4 py-3 text-white" placeholder="https://app.example.com/invite/accepted" />
        </label>
    </div>

    <button
        class="bg-[#B9BBBE] text-[#090909] rounded-full px-5 py-4 font-black transition-colors duration-300 hover:bg-[#A1A1A1] disabled:opacity-50 disabled:cursor-not-allowed"
        onclick={handleCreateAndShare}
        disabled={isSubmitting}
        aria-label={isSubmitting ? "Submitting shared key" : "Create and share"}
    >
        {#if isSubmitting}
            <div class="flex items-center justify-center">
                <Spinner size={24} />
            </div>
        {:else}
            Create And Share
        {/if}
    </button>

    {#if latestClaimUrl}
        <div class="bg-[#171717] rounded-[28px] p-5 flex flex-col gap-3">
            <Text type="h" size={18} mobileSize={16} weight="medium">Claim Link</Text>
            <p class="text-[#B9BBBE] break-all">{latestClaimUrl}</p>
            <button
                class="self-start border border-[#333333] rounded-full px-4 py-2 text-white hover:bg-[#1E1E1E] transition-colors duration-300"
                onclick={() => copyClaimUrl(latestClaimUrl)}
            >
                Copy Link
            </button>
        </div>
    {/if}

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div class="bg-[#171717] rounded-[28px] p-5 flex flex-col gap-4">
            <Text type="h" size={18} mobileSize={16} weight="medium">Created</Text>
            {#if loading}
                <div class="flex justify-center py-8">
                    <Spinner size={34} />
                </div>
            {:else if sharedSecretsQuery.data?.created?.length}
                {#each sharedSecretsQuery.data.created as secret}
                    <div class="border border-[#2A2A2A] rounded-2xl p-4 flex flex-col gap-2">
                        <p class="text-white font-semibold">{secret.label || secret.resourceKey || secret.id}</p>
                        <p class="text-[#878787] text-sm">{secret.kind} {secret.resourceKey ? `• ${secret.resourceKey}` : ""}</p>
                        {#if secret.transfers.length}
                            {#each secret.transfers as transfer}
                                <p class="text-[#B9BBBE] text-sm">@{transfer.targetHandle} • {transfer.status}</p>
                            {/each}
                        {:else}
                            <p class="text-[#878787] text-sm">No transfers yet.</p>
                        {/if}
                    </div>
                {/each}
            {:else}
                <div class="bg-[#111111] rounded-[20px] px-4 py-5">
                    <p class="text-[#878787]">No shared secrets created yet.</p>
                </div>
            {/if}
        </div>

        <div class="bg-[#171717] rounded-[28px] p-5 flex flex-col gap-4">
            <Text type="h" size={18} mobileSize={16} weight="medium">Received</Text>
            {#if loading}
                <div class="flex justify-center py-8">
                    <Spinner size={34} />
                </div>
            {:else if sharedSecretsQuery.data?.received?.length}
                {#each sharedSecretsQuery.data.received as received}
                    <div class="border border-[#2A2A2A] rounded-2xl p-4 flex flex-col gap-2">
                        <p class="text-white font-semibold">{received.descriptor.label || received.descriptor.resourceKey || received.sharedSecretId}</p>
                        <p class="text-[#878787] text-sm">From @{received.owner.handle}</p>
                        <p class="text-[#B9BBBE] text-sm">{received.descriptor.kind} {received.descriptor.resourceKey ? `• ${received.descriptor.resourceKey}` : ""}</p>
                    </div>
                {/each}
            {:else}
                <div class="bg-[#111111] rounded-[20px] px-4 py-5">
                    <p class="text-[#878787]">No received shared secrets yet.</p>
                </div>
            {/if}
        </div>
    </div>
</div>
