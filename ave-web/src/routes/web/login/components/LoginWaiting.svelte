<script lang="ts">
    import { onMount } from "svelte";
    import Text from "$lib/surfaces/web/components/Text.svelte";
    import Spinner from "$lib/surfaces/web/components/Spinner.svelte";
    import { api, ApiError } from "$lib/surfaces/web/lib/api";
    import { decryptMasterKeyFromDevice } from "$lib/surfaces/web/lib/crypto";
    import { auth } from "$lib/surfaces/web/stores/auth";
    import { watchLoginRequest } from "$lib/surfaces/web/stores/websocket";

    let { loginRequestId, loginRequestToken, ephemeralKeyPair, masterKeyOnly = false, onSuccess, onError, onBack } = $props<{
        loginRequestId: string | null;
        loginRequestToken: string | null;
        ephemeralKeyPair: { publicKey: string; privateKey: CryptoKey } | null;
        masterKeyOnly?: boolean;
        onSuccess?: () => void;
        onError?: (error: string) => void;
        onBack?: () => void;
    }>();

    let status = $state<"waiting" | "approved" | "denied" | "expired">("waiting");
    let stopWatching = () => {};

    onMount(() => {
        if (!loginRequestId || !loginRequestToken || !ephemeralKeyPair) {
            onError?.("No login request available");
            return;
        }
        const requestId = loginRequestId;
        const requestToken = loginRequestToken;
        const privateKey = ephemeralKeyPair.privateKey;
        let active = true;
        let checking = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let unsubscribe = () => {};

        stopWatching = () => {
            active = false;
            clearTimeout(timer);
            unsubscribe();
        };

        async function checkStatus() {
            if (!active || checking) return;
            checking = true;
            clearTimeout(timer);
            try {
                const result = await api.login.checkRequestStatus(requestId, requestToken);
                if (!active) return;
                if (result.status === "pending") return;
                stopWatching();
                status = result.status;
                if (result.status !== "approved") {
                    onError?.(result.status === "denied" ? "Login request was denied" : "Login request expired");
                    return;
                }
                const masterKey = await decryptMasterKeyFromDevice(
                    result.encryptedMasterKey, result.approverPublicKey, privateKey,
                );
                await auth.login(result, masterKey, {
                    offerPasskeySetup: !masterKeyOnly && Boolean(result.device.isNew),
                    preserveCurrentIdentity: masterKeyOnly,
                });
                onSuccess?.();
            } catch (error) {
                if (!active && status !== "approved") return;
                if (error instanceof ApiError && (error.status === 404 || error.status === 410)) {
                    stopWatching();
                    status = "expired";
                    onError?.("Login request expired");
                } else if (status === "approved") {
                    status = "expired";
                    onError?.("Could not restore the encryption key. Please try again.");
                }
            } finally {
                checking = false;
                if (active) timer = setTimeout(checkStatus, 2000);
            }
        }

        unsubscribe = watchLoginRequest(requestId, requestToken, () => void checkStatus());
        void checkStatus();
        return () => stopWatching();
    });

    function handleCancel() {
        stopWatching();
        onBack?.();
    }
</script>

<div class="w-full max-w-[720px] md:max-w-none md:w-[50%] h-auto flex flex-col items-center z-10 gap-6 md:gap-[40px] px-4 md:px-0">
    <div class="text-center">
        <h1 class="font-black text-2xl md:text-[36px] text-[#FFFFFF]/80">WAITING FOR APPROVAL</h1>
        <p class="text-[#878787] text-sm md:text-base mt-2">
            {#if masterKeyOnly}
                Open Ave on one of your trusted devices and approve this request to transfer your encryption key.
            {:else}
                Open Ave on one of your trusted devices and approve this login request.
            {/if}
        </p>
    </div>

    <div class="flex flex-col items-center gap-4 md:gap-6 p-5 md:p-8 bg-[#171717]/80 rounded-[24px] md:rounded-[32px] w-full md:w-auto">
        {#if status === "waiting"}
            <Spinner />
            <Text type="p" size={18} color="#878787">
                Waiting for approval...
            </Text>
            <p class="text-[#555] text-sm text-center max-w-sm">
                {#if masterKeyOnly}
                    A notification has been sent to your trusted devices.
                    Open the Ave app and tap "Approve" to continue.
                {:else}
                    A notification has been sent to your trusted devices. 
                    Open the Ave app and tap "Approve" to sign in.
                {/if}
            </p>
        {:else if status === "approved"}
            <div class="w-16 h-16 bg-[#32A94C]/20 rounded-full flex items-center justify-center">
                <svg class="w-8 h-8 text-[#32A94C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <Text type="p" size={18} color="#32A94C">
                {masterKeyOnly ? "Approved! Restoring your encryption key…" : "Approved! Signing you in..."}
            </Text>
        {:else if status === "denied"}
            <div class="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </div>
            <Text type="p" size={18} color="#E14747">
                Request denied
            </Text>
        {:else if status === "expired"}
            <div class="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <svg class="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <Text type="p" size={18} color="#FFB400">
                Request expired
            </Text>
        {/if}
    </div>

    {#if status === "waiting"}
        <button 
            class="px-[20px] py-[15px] text-[#878787] hover:text-white transition-colors rounded-full"
            onclick={handleCancel}
        >
            Cancel and try another method
        </button>
    {:else if status !== "approved"}
        <button 
            class="px-[20px] py-[15px] text-[#878787] hover:text-white transition-colors rounded-full"
            onclick={onBack}
        >
            Try another method
        </button>
    {/if}
</div>
