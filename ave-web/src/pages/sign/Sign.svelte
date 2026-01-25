<script lang="ts">
    import Text from "../../components/Text.svelte";
    import { api } from "../../lib/api";
    import { signWithIdentityKey } from "../../lib/signing";
    import { isAuthenticated } from "../../stores/auth";
    import { goto } from "@mateothegreat/svelte5-router";

    // Get request ID from URL
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get("requestId");
    const embed = params.get("embed") === "1";

    let loading = $state(true);
    let signing = $state(false);
    let error = $state<string | null>(null);
    
    let request = $state<{
        id: string;
        payload: string;
        metadata?: Record<string, unknown>;
        status: string;
        createdAt: string;
        expiresAt: string;
    } | null>(null);
    
    let app = $state<{
        id: string;
        name: string;
        iconUrl?: string;
        websiteUrl?: string;
    } | null>(null);
    
    let identity = $state<{
        id: string;
        handle: string;
        displayName: string;
    } | null>(null);
    
    let signingKey = $state<{
        publicKey: string;
        encryptedPrivateKey: string;
    } | null>(null);

    async function loadRequest() {
        if (!requestId) {
            error = "Missing request ID";
            loading = false;
            return;
        }

        try {
            loading = true;
            const data = await api.signing.getRequest(requestId);
            
            request = data.request;
            app = data.app;
            identity = data.identity;
            signingKey = data.signingKey;
            
            if (request.status !== "pending") {
                error = `This request has already been ${request.status}`;
            }
            
            if (!signingKey) {
                error = "No signing key found for this identity. Please set up signing in your dashboard.";
            }
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load signature request";
        } finally {
            loading = false;
        }
    }

    async function handleSign() {
        if (!request || !signingKey || !identity) return;
        
        try {
            signing = true;
            error = null;
            
            // Sign the payload client-side
            const signature = await signWithIdentityKey(request.payload, signingKey.encryptedPrivateKey);
            
            if (!signature) {
                error = "Failed to sign: encryption key not available";
                signing = false;
                return;
            }
            
            // Submit the signature to the server
            await api.signing.sign(request.id, signature);
            
            // Notify parent if embedded
            if (embed) {
                window.parent?.postMessage({
                    type: "ave:signed",
                    payload: {
                        requestId: request.id,
                        signature,
                        publicKey: signingKey.publicKey,
                    }
                }, "*");
                return;
            }
            
            // Show success and close
            request = { ...request, status: "signed" };
            
            // Auto-close after a moment
            setTimeout(() => {
                window.close();
            }, 1500);
            
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to sign";
        } finally {
            signing = false;
        }
    }

    async function handleDeny() {
        if (!request) return;
        
        try {
            signing = true;
            error = null;
            
            await api.signing.deny(request.id);
            
            // Notify parent if embedded
            if (embed) {
                window.parent?.postMessage({
                    type: "ave:denied",
                    payload: { requestId: request.id }
                }, "*");
                return;
            }
            
            request = { ...request, status: "denied" };
            
            setTimeout(() => {
                window.close();
            }, 1500);
            
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to deny";
        } finally {
            signing = false;
        }
    }

    // Check auth and load request
    $effect(() => {
        if (!$isAuthenticated) {
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            goto(`/login?return=${returnUrl}`);
            return;
        }
        loadRequest();
    });

    function formatPayload(payload: string): string {
        // Try to parse as JSON for better display
        try {
            const parsed = JSON.parse(payload);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return payload;
        }
    }

    function isExpired(): boolean {
        if (!request) return false;
        return new Date() > new Date(request.expiresAt);
    }
</script>

<div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center z-50 backdrop-blur-sm">
    <!-- Bottom sheet on mobile, centered modal on desktop -->
    <div class="w-full max-w-[600px] bg-[#111111] rounded-t-[32px] md:rounded-[32px] overflow-hidden animate-slide-up">
        {#if loading}
            <div class="p-8 md:p-12 flex items-center justify-center min-h-[300px]">
                <div class="w-[48px] h-[48px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
            </div>
        {:else if request?.status === "signed"}
            <div class="p-8 md:p-12 flex flex-col items-center justify-center min-h-[300px] gap-6">
                <div class="w-[80px] h-[80px] rounded-full bg-[#32A94C]/20 flex items-center justify-center">
                    <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 13L9 17L19 7" stroke="#32A94C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <Text type="h" size={24} weight="bold" color="#32A94C">Signed Successfully</Text>
                <Text type="p" size={16} color="#878787">This window will close automatically.</Text>
            </div>
        {:else if request?.status === "denied"}
            <div class="p-8 md:p-12 flex flex-col items-center justify-center min-h-[300px] gap-6">
                <div class="w-[80px] h-[80px] rounded-full bg-[#E14747]/20 flex items-center justify-center">
                    <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 18L18 6M6 6L18 18" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <Text type="h" size={24} weight="bold" color="#E14747">Request Denied</Text>
                <Text type="p" size={16} color="#878787">This window will close automatically.</Text>
            </div>
        {:else if error}
            <div class="p-8 md:p-12 flex flex-col items-center justify-center min-h-[300px] gap-6">
                <div class="w-[80px] h-[80px] rounded-full bg-[#E14747]/20 flex items-center justify-center">
                    <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 9V13M12 17H12.01M12 3L3 20H21L12 3Z" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <Text type="h" size={24} weight="bold" color="#E14747">Error</Text>
                <Text type="p" size={16} color="#878787" cclass="text-center">{error}</Text>
                <button 
                    class="px-6 py-3 bg-[#222222] hover:bg-[#333333] rounded-full text-[#FFFFFF] transition-colors"
                    onclick={() => window.close()}
                >
                    Close
                </button>
            </div>
        {:else if request && app && identity}
            <!-- Header -->
            <div class="p-6 md:p-8 border-b border-[#222222]">
                <div class="flex items-center gap-4">
                    {#if app.iconUrl}
                        <img src={app.iconUrl} alt="{app.name}" class="w-12 h-12 md:w-16 md:h-16 rounded-2xl"/>
                    {:else}
                        <div class="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-[#222222] flex items-center justify-center">
                            <Text type="h" size={24} color="#878787">{app.name[0]}</Text>
                        </div>
                    {/if}
                    <div class="flex-1">
                        <Text type="h" size={20} mobileSize={18} weight="bold">{app.name}</Text>
                        <Text type="p" size={14} color="#878787">wants you to sign a message</Text>
                    </div>
                </div>
            </div>

            <!-- Identity -->
            <div class="px-6 md:px-8 py-4 bg-[#0a0a0a]">
                <Text type="p" size={12} color="#666666" cclass="uppercase tracking-wider mb-2">Signing as</Text>
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-[#222222] flex items-center justify-center">
                        <Text type="h" size={14} color="#FFFFFF">{identity.displayName[0]}</Text>
                    </div>
                    <div>
                        <Text type="p" size={16} weight="semibold">{identity.displayName}</Text>
                        <Text type="p" size={12} color="#878787">@{identity.handle}</Text>
                    </div>
                </div>
            </div>

            <!-- Payload -->
            <div class="p-6 md:p-8">
                <Text type="p" size={12} color="#666666" cclass="uppercase tracking-wider mb-3">Message to sign</Text>
                <div class="bg-[#0a0a0a] rounded-2xl p-4 max-h-[200px] overflow-y-auto">
                    <pre class="text-[#FFFFFF] text-sm font-mono whitespace-pre-wrap break-words">{formatPayload(request.payload)}</pre>
                </div>
                
                {#if request.metadata && Object.keys(request.metadata).length > 0}
                    <div class="mt-4">
                        <Text type="p" size={12} color="#666666" cclass="uppercase tracking-wider mb-2">Additional info</Text>
                        <div class="flex flex-wrap gap-2">
                            {#each Object.entries(request.metadata) as [key, value]}
                                <span class="px-3 py-1 bg-[#222222] rounded-full text-[#878787] text-xs">
                                    {key}: {String(value)}
                                </span>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if isExpired()}
                    <div class="mt-4 p-3 bg-[#E14747]/20 border border-[#E14747] rounded-xl">
                        <Text type="p" size={14} color="#E14747">This request has expired.</Text>
                    </div>
                {/if}
            </div>

            <!-- Actions -->
            <div class="p-6 md:p-8 pt-0 flex flex-col gap-3">
                <button 
                    class="w-full py-4 bg-[#FFFFFF] text-[#000000] font-semibold rounded-2xl hover:bg-[#E0E0E0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    onclick={handleSign}
                    disabled={signing || isExpired()}
                >
                    {#if signing}
                        <div class="w-5 h-5 border-2 border-[#000000] border-t-transparent rounded-full animate-spin"></div>
                    {:else}
                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    {/if}
                    Sign Message
                </button>
                <button 
                    class="w-full py-4 bg-[#222222] text-[#878787] font-semibold rounded-2xl hover:bg-[#333333] hover:text-[#FFFFFF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onclick={handleDeny}
                    disabled={signing}
                >
                    Deny
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
    @keyframes slide-up {
        from {
            transform: translateY(100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    .animate-slide-up {
        animation: slide-up 0.3s ease-out;
    }
</style>
