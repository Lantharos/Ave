<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "@mateothegreat/svelte5-router";
    import Text from "../../components/Text.svelte";
    import Spinner from "../../components/Spinner.svelte";
    import AuroraBackdrop from "../../components/AuroraBackdrop.svelte";
    import { api } from "../../lib/api";
    import {
        decryptSecretFromIdentity,
        encrypt,
        loadIdentityEncryptionPrivateKey,
        loadMasterKey,
    } from "../../lib/crypto";
    import { auth, identities, isAuthenticated } from "../../stores/auth";
    import { setReturnUrl } from "../../util/return-url";
    import { safeGoto } from "../../util/safe-goto";

    let loading = $state(true);
    let claiming = $state(false);
    let error = $state("");
    let success = $state("");
    let transfer = $state<Awaited<ReturnType<typeof api.sharedSecrets.getTransfer>>["transfer"] | null>(null);

    const token = new URLSearchParams(window.location.search).get("token") || "";
    const availableIdentities = $derived($identities);
    const matchingIdentity = $derived.by(() => {
        const activeTransfer = transfer;
        if (!activeTransfer) return null;
        return availableIdentities.find((identity) => identity.handle === activeTransfer.targetHandle) || null;
    });

    onMount(async () => {
        if (!token) {
            error = "Missing claim token.";
            loading = false;
            return;
        }

        try {
            const result = await api.sharedSecrets.getTransfer(token);
            transfer = result.transfer;
        } catch (e: any) {
            error = e.message || "Could not load transfer.";
            loading = false;
            return;
        }

        if (!$isAuthenticated) {
            setReturnUrl(`/shared/claim?token=${encodeURIComponent(token)}`);
            goto("/login");
            return;
        }

        loading = false;
    });

    async function handleClaim() {
        if (!transfer || !matchingIdentity) {
            error = "You do not have the target identity signed in on this device.";
            return;
        }

        claiming = true;
        error = "";

        try {
            const masterKey = await loadMasterKey();
            if (!masterKey) {
                throw new Error("Your encryption key is not available on this device.");
            }

            const keyState = await api.encryption.getKey(matchingIdentity.id);
            if (!keyState.hasKey || !keyState.encryptedPrivateKey) {
                throw new Error("This identity does not have an encryption key yet. Open Shared Keys on a trusted device first.");
            }

            const claim = await api.sharedSecrets.claimTransfer(token, matchingIdentity.id);
            const privateKey = await loadIdentityEncryptionPrivateKey(keyState.encryptedPrivateKey, masterKey);
            const plaintextSecret = await decryptSecretFromIdentity(
                claim.transfer.encryptedSecretForTarget,
                claim.transfer.senderPublicKey,
                privateKey
            );
            const encryptedSecretForRecipient = await encrypt(plaintextSecret, masterKey);

            await api.sharedSecrets.finalizeRecipientStorage(claim.transfer.sharedSecretId, {
                identityId: matchingIdentity.id,
                transferId: claim.transfer.id,
                encryptedSecretForRecipient,
            });

            success = `Shared key accepted for @${matchingIdentity.handle}.`;
            const nextUrl = buildReturnUrl(
                claim.transfer.returnUrl,
                claim.transfer.sharedSecretId,
                claim.transfer.id,
                matchingIdentity.id
            );
            setTimeout(() => {
                if (nextUrl) {
                    navigateTo(nextUrl);
                } else {
                    safeGoto(goto, "/dashboard");
                }
            }, 800);
        } catch (e: any) {
            error = e.message || "Failed to claim transfer.";
        } finally {
            claiming = false;
        }
    }

    function buildReturnUrl(returnUrl: string | null | undefined, sharedSecretId: string, transferId: string, identityId: string): string | null {
        if (!returnUrl) return null;

        try {
            const url = new URL(returnUrl, window.location.origin);
            url.searchParams.set("shared_secret_claimed", "1");
            url.searchParams.set("shared_secret_id", sharedSecretId);
            url.searchParams.set("transfer_id", transferId);
            url.searchParams.set("identity_id", identityId);
            return url.toString();
        } catch {
            return null;
        }
    }

    function navigateTo(url: string) {
        try {
            const parsed = new URL(url, window.location.origin);
            if (parsed.origin === window.location.origin) {
                safeGoto(goto, parsed.pathname + parsed.search + parsed.hash);
                return;
            }
        } catch {
        }

        window.location.assign(url);
    }
</script>

<div class="relative w-full min-h-screen-fixed overflow-hidden bg-[#090909]">
    <AuroraBackdrop preset="reg-finishing" mobileHeight={420} cclass="absolute inset-x-0 bottom-0 h-[720px] pointer-events-none select-none" />
    <div class="relative z-10 min-h-screen-fixed flex items-center justify-center px-4 py-10">
        <div class="w-full max-w-[720px] bg-[#111111]/70 backdrop-blur-[20px] rounded-[32px] p-6 md:p-10 flex flex-col gap-5">
            <div class="flex flex-col gap-2">
                <div class="self-start px-3 py-1 rounded-full border border-[#2A2A2A] bg-[#171717] text-[#B9BBBE] text-xs tracking-[0.18em]">SHARED KEY CLAIM</div>
                <Text type="h" size={30} mobileSize={22} weight="medium">Claim Shared Key</Text>
            </div>

            {#if loading}
                <div class="flex justify-center py-6">
                    <Spinner size={42} />
                </div>
            {:else}
                {#if error}
                    <div class="bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-2xl">{error}</div>
                {/if}

                {#if success}
                    <div class="bg-[#32A94C]/20 border border-[#32A94C] text-[#32A94C] px-4 py-3 rounded-2xl">{success}</div>
                {/if}

                {#if transfer}
                    <div class="bg-[#171717] rounded-[24px] p-5 flex flex-col gap-3 border border-[#232323]">
                        <p class="text-white font-semibold">{transfer.descriptor.label || transfer.descriptor.resourceKey || transfer.descriptor.id}</p>
                        <div class="flex flex-wrap gap-2 text-xs">
                            <span class="px-3 py-1 rounded-full bg-[#111111] text-[#878787]">From @{transfer.owner.handle}</span>
                            <span class="px-3 py-1 rounded-full bg-[#111111] text-[#B9BBBE]">For @{transfer.targetHandle}</span>
                            <span class="px-3 py-1 rounded-full bg-[#111111] text-[#B9BBBE]">{transfer.descriptor.kind}</span>
                            {#if transfer.descriptor.resourceKey}
                                <span class="px-3 py-1 rounded-full bg-[#111111] text-[#B9BBBE]">{transfer.descriptor.resourceKey}</span>
                            {/if}
                        </div>
                    </div>
                {/if}

                {#if $isAuthenticated && transfer}
                    {#if matchingIdentity}
                        <button
                            class="bg-[#B9BBBE] text-[#090909] rounded-full px-5 py-4 font-black transition-colors duration-300 hover:bg-[#A1A1A1] disabled:opacity-50 disabled:cursor-not-allowed"
                            onclick={handleClaim}
                            disabled={claiming}
                            aria-label={claiming ? "Claiming shared key" : `Claim as @${matchingIdentity.handle}`}
                        >
                            {#if claiming}
                                <div class="flex items-center justify-center">
                                    <Spinner size={24} />
                                </div>
                            {:else}
                                Claim As @{matchingIdentity.handle}
                            {/if}
                        </button>
                    {:else}
                        <p class="text-[#878787]">You’re signed in, but none of your loaded identities match @{transfer.targetHandle}.</p>
                    {/if}
                {/if}
            {/if}
        </div>
    </div>
</div>
