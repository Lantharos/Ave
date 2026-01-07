<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import Text from "../../../components/Text.svelte";
    import Spinner from "../../../components/Spinner.svelte";
    import { api } from "../../../lib/api";
    import { decryptMasterKeyFromDevice } from "../../../lib/crypto";
    import { auth } from "../../../stores/auth";
    import { websocket } from "../../../stores/websocket";

    let { loginRequestId, ephemeralKeyPair, onSuccess, onError, onBack } = $props<{
        loginRequestId: string | null;
        ephemeralKeyPair: { publicKey: string; privateKey: CryptoKey } | null;
        onSuccess?: () => void;
        onError?: (error: string) => void;
        onBack?: () => void;
    }>();

    let status = $state<"waiting" | "approved" | "denied" | "expired">("waiting");
    let pollInterval: number | null = null;

    onMount(() => {
        if (!loginRequestId) {
            onError?.("No login request ID");
            return;
        }

        // Start polling for status updates
        pollInterval = window.setInterval(checkStatus, 2000);
        
        // Also connect to WebSocket for real-time updates
        websocket.subscribeToLoginRequest(loginRequestId);
        websocket.onLoginRequestStatus(handleStatusUpdate);
    });

    onDestroy(() => {
        if (pollInterval) {
            clearInterval(pollInterval);
        }
        websocket.disconnect();
        websocket.clearHandlers();
    });

    async function checkStatus() {
        if (!loginRequestId) return;
        
        try {
            const result = await api.login.checkRequestStatus(loginRequestId);
            await handleStatusUpdate(result);
        } catch (e: any) {
            console.error("Failed to check status:", e);
        }
    }

    async function handleStatusUpdate(data: {
        status: string;
        sessionToken?: string;
        encryptedMasterKey?: string;
        device?: any;
        identities?: any[];
    }) {
        if (data.status === "approved") {
            status = "approved";
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
            
            // If we have full data (from polling), use it directly
            if (data.sessionToken && data.identities && data.device) {
                await completeLogin(data);
            } else {
                // WebSocket only sent partial data, fetch full session from API
                await fetchSessionAndLogin();
            }
        } else if (data.status === "denied") {
            status = "denied";
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
            onError?.("Login request was denied");
        } else if (data.status === "expired") {
            status = "expired";
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
            onError?.("Login request expired");
        }
    }

    async function fetchSessionAndLogin() {
        if (!loginRequestId) return;
        
        try {
            const result = await api.login.checkRequestStatus(loginRequestId);
            if (result.status === "approved" && result.sessionToken && result.identities && result.device) {
                await completeLogin(result);
            } else {
                console.error("Failed to get session data after approval:", result);
                onError?.("Failed to complete login after approval");
            }
        } catch (e: any) {
            console.error("Failed to fetch session:", e);
            onError?.("Failed to complete login");
        }
    }

    async function completeLogin(data: {
        sessionToken?: string;
        encryptedMasterKey?: string;
        device?: any;
        identities?: any[];
    }) {
        if (!data.sessionToken || !data.identities || !data.device) return;
        
        // Try to decrypt the master key
        let masterKey = undefined;
        
        if (data.encryptedMasterKey && ephemeralKeyPair) {
            try {
                // We need the approver's public key, which should be in the response
                // For now, we'll skip this since the key transfer is complex
                // In production, you'd need the approver to send their ephemeral public key too
                console.log("Master key transfer not yet implemented");
            } catch (e) {
                console.error("Failed to decrypt master key:", e);
            }
        }
        
        await auth.login(
            data.sessionToken,
            data.identities,
            data.device,
            masterKey
        );
        
        onSuccess?.();
    }

    function handleCancel() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        onBack?.();
    }
</script>

<div class="w-[50%] h-auto flex flex-col items-center z-10 gap-[40px]">
    <div class="text-center">
        <h1 class="font-black text-[36px] text-[#FFFFFF]/80">WAITING FOR APPROVAL</h1>
        <p class="text-[#878787] mt-2">
            Open Ave on one of your trusted devices and approve this login request.
        </p>
    </div>

    <div class="flex flex-col items-center gap-6 p-8 bg-[#171717]/80 rounded-[32px]">
        {#if status === "waiting"}
            <Spinner />
            <Text type="p" size={18} color="#878787">
                Waiting for approval...
            </Text>
            <p class="text-[#555] text-sm text-center max-w-sm">
                A notification has been sent to your trusted devices. 
                Open the Ave app and tap "Approve" to sign in.
            </p>
        {:else if status === "approved"}
            <div class="w-16 h-16 bg-[#32A94C]/20 rounded-full flex items-center justify-center">
                <svg class="w-8 h-8 text-[#32A94C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <Text type="p" size={18} color="#32A94C">
                Approved! Signing you in...
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
