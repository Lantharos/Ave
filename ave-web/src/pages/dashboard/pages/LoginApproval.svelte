<script lang="ts">
    import { onMount } from "svelte";
    import Text from "../../../components/Text.svelte";
    import ActionCard from "../../../components/ActionCard.svelte";
    import { api, type LoginRequest } from "../../../lib/api";
    import { loadMasterKey, encryptMasterKeyForDevice, generateEphemeralKeyPair } from "../../../lib/crypto";

    let { pendingCount = $bindable(0) } = $props<{ pendingCount?: number }>();

    let requests = $state<LoginRequest[]>([]);
    let isLoading = $state(true);
    let processingId = $state<string | null>(null);
    let error = $state("");

    onMount(async () => {
        await loadRequests();
    });

    async function loadRequests() {
        isLoading = true;
        try {
            const result = await api.devices.getPendingRequests();
            requests = result.requests;
            pendingCount = requests.length;
        } catch (e: any) {
            error = e.message || "Failed to load requests";
        } finally {
            isLoading = false;
        }
    }

    async function approveRequest(request: LoginRequest) {
        processingId = request.id;
        error = "";
        
        try {
            // Load our master key
            const masterKey = await loadMasterKey();
            if (!masterKey) {
                error = "Cannot approve: Master key not available on this device";
                return;
            }

            // Generate our own ephemeral keypair for the exchange
            const ourKeyPair = await generateEphemeralKeyPair();
            
            // Encrypt our master key with the requester's public key
            const encryptedMasterKey = await encryptMasterKeyForDevice(
                masterKey,
                request.requesterPublicKey,
                ourKeyPair.privateKey
            );

            // Send approval with encrypted master key + our public key
            await api.devices.approveRequest(
                request.id,
                encryptedMasterKey,
                ourKeyPair.publicKey
            );
            
            // Remove from list
            requests = requests.filter(r => r.id !== request.id);
            pendingCount = requests.length;
        } catch (e: any) {
            error = e.message || "Failed to approve request";
        } finally {
            processingId = null;
        }
    }

    async function denyRequest(request: LoginRequest) {
        processingId = request.id;
        error = "";
        
        try {
            await api.devices.denyRequest(request.id);
            requests = requests.filter(r => r.id !== request.id);
            pendingCount = requests.length;
        } catch (e: any) {
            error = e.message || "Failed to deny request";
        } finally {
            processingId = null;
        }
    }

    function formatTime(dateStr: string): string {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        return date.toLocaleTimeString();
    }
</script>

<div class="flex flex-col gap-3 md:gap-[30px]">
    <div class="flex flex-col gap-1 md:gap-[10px]">
        <Text type="hd" size={36} mobileSize={22}>LOGIN REQUESTS</Text>
        <Text type="p" size={18} mobileSize={13}>
            These devices are trying to log in to your account. Only approve requests you initiated.
        </Text>
    </div>

    {#if error}
        <div class="bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-2xl">
            {error}
        </div>
    {/if}

    {#if isLoading}
        <div class="flex items-center justify-center py-8 md:py-12">
            <div class="w-8 h-8 border-2 border-transparent border-t-white rounded-full animate-spin"></div>
        </div>
    {:else if requests.length === 0}
        <div class="flex flex-col items-center justify-center py-8 md:py-12 gap-4">
            <div class="w-16 h-16 bg-[#171717] rounded-full flex items-center justify-center">
                <svg class="w-8 h-8 text-[#555]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
            </div>
            <Text type="p" size={18} color="#555">No pending login requests</Text>
        </div>
    {:else}
        <div class="flex flex-col gap-4">
            {#each requests as request}
                <div class="p-4 md:p-6 bg-[#171717] rounded-[24px] md:rounded-[32px] flex flex-col gap-4">
                    <div class="flex flex-col md:flex-row md:items-start justify-between gap-2 md:gap-0">
                        <div class="flex items-center gap-3 md:gap-4">
                            <div class="w-10 h-10 md:w-12 md:h-12 bg-[#222] rounded-full flex items-center justify-center">
                                {#if request.deviceType === "phone"}
                                    <svg class="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                {:else if request.deviceType === "tablet"}
                                    <svg class="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                {:else}
                                    <svg class="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                {/if}
                            </div>
                            <div>
                                <Text type="hd" size={18}>{request.deviceName || "Unknown Device"}</Text>
                                <Text type="p" size={14} color="#878787">
                                    {request.browser || "Unknown Browser"} on {request.os || "Unknown OS"}
                                </Text>
                                {#if request.ipAddress}
                                    <Text type="p" size={12} color="#555">IP: {request.ipAddress}</Text>
                                {/if}
                            </div>
                        </div>
                        <Text type="p" size={14} color="#555">{formatTime(request.createdAt)}</Text>
                    </div>

                    <div class="flex gap-2 md:gap-3">
                        <button 
                            class="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full font-semibold transition-colors disabled:opacity-50 text-sm md:text-base"
                            onclick={() => approveRequest(request)}
                            disabled={processingId === request.id}
                        >
                            {processingId === request.id ? "Approving..." : "Approve"}
                        </button>
                        <button 
                            class="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-full font-semibold transition-colors disabled:opacity-50 text-sm md:text-base"
                            onclick={() => denyRequest(request)}
                            disabled={processingId === request.id}
                        >
                            Deny
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
