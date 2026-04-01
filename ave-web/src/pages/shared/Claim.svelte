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
    let embed = $state(false);

    const token = new URLSearchParams(window.location.search).get("token") || "";

    function postToEmbedHost(payload: unknown) {
        const target =
            window.opener && (window.opener as Window & { parent?: Window }).parent
                ? (window.opener as Window & { parent: Window }).parent
                : window.opener ?? window.parent;
        target?.postMessage(payload, "*");
    }
    const availableIdentities = $derived($identities);
    const matchingIdentity = $derived.by(() => {
        const activeTransfer = transfer;
        if (!activeTransfer) return null;
        return availableIdentities.find((identity) => identity.handle === activeTransfer.targetHandle) || null;
    });

    onMount(async () => {
        embed = new URLSearchParams(window.location.search).get("embed") === "1";

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
            const qs = new URLSearchParams();
            qs.set("token", token);
            if (embed) qs.set("embed", "1");
            setReturnUrl(`/shared/claim?${qs.toString()}`);
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
                throw new Error("This identity does not have an encryption key yet. Open App keys on a trusted device first.");
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

            success = `Key added for @${matchingIdentity.handle}.`;
            const nextUrl = buildReturnUrl(
                claim.transfer.returnUrl,
                claim.transfer.sharedSecretId,
                claim.transfer.id,
                matchingIdentity.id
            );

            if (embed) {
                postToEmbedHost({
                    type: "ave:success",
                    payload: {
                        kind: "app_key_claim",
                        redirectUrl: nextUrl,
                        sharedSecretId: claim.transfer.sharedSecretId,
                        transferId: claim.transfer.id,
                        identityId: matchingIdentity.id,
                        handle: matchingIdentity.handle,
                    },
                });
                return;
            }

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

<div class="relative w-full min-h-screen-fixed overflow-hidden bg-[#090909]" class:min-h-[min(100dvh,720px)]={embed}>
    {#if !embed}
        <AuroraBackdrop preset="reg-finishing" mobileHeight={420} cclass="absolute inset-x-0 bottom-0 h-[720px] pointer-events-none select-none" />
    {/if}
    <div class="relative z-10 min-h-screen-fixed flex items-center justify-center px-4 py-10" class:py-6={embed}>
        <div class="w-full max-w-[720px] bg-[#111111]/70 backdrop-blur-[20px] rounded-[32px] p-6 md:p-10 flex flex-col gap-5">
            <div class="flex flex-col gap-2">
                <Text type="h" size={30} mobileSize={22} weight="bold">Accept app key</Text>
                <p class="text-[#878787] text-sm md:text-[16px]">Confirm this key for your Ave account so your apps can decrypt.</p>
            </div>

            {#if loading}
                <div class="flex justify-center py-6">
                    <Spinner size={42} />
                </div>
            {:else}
                {#if error}
                    <div class="bg-[#E14747]/20 border border-[#E14747] rounded-[16px] px-4 py-3">
                        <p class="text-[#E14747] text-sm md:text-[16px]">{error}</p>
                    </div>
                {/if}

                {#if success}
                    <div class="bg-[#32A94C]/20 border border-[#32A94C] text-[#32A94C] px-4 py-3 rounded-2xl">{success}</div>
                {/if}

                {#if transfer}
                    <div class="bg-[#171717] rounded-[20px] md:rounded-[28px] p-5 flex flex-col gap-2 border border-[#2A2A2A]">
                        <p class="text-white font-medium">{transfer.descriptor.label || transfer.descriptor.resourceKey || transfer.descriptor.id}</p>
                        <p class="text-[#878787] text-sm">From @{transfer.owner.handle} · for @{transfer.targetHandle}</p>
                        {#if transfer.descriptor.resourceKey}
                            <p class="text-[#B9BBBE] text-sm">{transfer.descriptor.resourceKey}</p>
                        {/if}
                    </div>
                {/if}

                {#if $isAuthenticated && transfer}
                    {#if matchingIdentity}
                        <button
                            class="w-full py-3 md:py-[15px] bg-[#FFFFFF] text-[#000000] font-semibold rounded-[16px] hover:bg-[#E0E0E0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            onclick={handleClaim}
                            disabled={claiming}
                            aria-label={claiming ? "Adding key" : `Add key as @${matchingIdentity.handle}`}
                        >
                            {#if claiming}
                                <Spinner size={24} />
                            {:else}
                                Add to @{matchingIdentity.handle}
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
