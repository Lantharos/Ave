<script lang="ts">
    import Text from "../../components/Text.svelte";
    import { api } from "../../lib/api";
    import { createSigningKeyForIdentity, signWithIdentityKey } from "../../lib/signing";
    import { auth, isAuthenticated } from "../../stores/auth";
    import { setReturnUrl } from "../../util/return-url";
    import { goto } from "@mateothegreat/svelte5-router";
    import { safeGoto } from "../../util/safe-goto";
    import StorageAccessGate from "../../components/StorageAccessGate.svelte";
    import { supportsStorageAccessApi, hasStorageAccess, requestStorageAccess } from "../../lib/storage-access";
    import { unlockMasterKeyWithPasskey } from "../../lib/master-key-unlock";

    function postToEmbedHost(payload: unknown) {
        const target = (window.opener && (window.opener as any).parent) ? (window.opener as any).parent : (window.opener ?? window.parent);
        target?.postMessage(payload, "*");
    }

    function openSigningPopupHere(): boolean {
        const width = 500;
        const height = 600;
        const left = (window.innerWidth - width) / 2 + window.screenX;
        const top = (window.innerHeight - height) / 2 + window.screenY;
        const popup = window.open(
            window.location.href,
            "ave_signing",
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );
        popup?.focus?.();
        return !!popup;
    }

    async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
        let timer: number | undefined;
        try {
            return await Promise.race([
                promise,
                new Promise<null>((resolve) => {
                    timer = window.setTimeout(() => resolve(null), ms);
                }),
            ]);
        } finally {
            if (timer !== undefined) window.clearTimeout(timer);
        }
    }

    // Get request ID from URL
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get("requestId");
    const embed = params.get("embed") === "1";
    const embedPopup = embed && !!window.opener;
    const embedSheet = embed && !embedPopup;

    let loading = $state(true);
    let signing = $state(false);
    let error = $state<string | null>(null);
    let authRequested = $state(false);
    let needsStorageAccess = $state(false);
    let redirectingToLogin = $state(false);
    let requestingStorageAccess = $state(false);
    let storageAccessError = $state<string | null>(null);
    let storageAccessAttempted = $state(false);

    let needsMasterKey = $state(false);
    let unlockingMasterKey = $state(false);
    let masterKeyError = $state<string | null>(null);
    
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
        avatarUrl?: string | null;
    } | null>(null);
    
    let signingKey = $state<{
        publicKey: string;
        encryptedPrivateKey: string;
    } | null>(null);

    let needsSigningKey = $state(false);
    let settingUpKey = $state(false);
    let setupError = $state<string | null>(null);

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

            needsSigningKey = !data.signingKey;
            setupError = null;
            
            if (request.status !== "pending") {
                error = `This request has already been ${request.status}`;
            }

            // If the request is pending but the user has no signing key yet, show setup UI.
            if (request.status === "pending" && !data.signingKey) {
                error = null;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load signature request";
        } finally {
            loading = false;
        }
    }

    async function handleSetupSigningKey() {
        if (!identity) return;
        try {
            settingUpKey = true;
            setupError = null;

            const created = await createSigningKeyForIdentity();
            if (!created) {
                needsMasterKey = true;
                masterKeyError = null;
                setupError = "";
                return;
            }

            await api.signing.createKey(identity.id, created.publicKey, created.encryptedPrivateKey);
            await loadRequest();
        } catch (err) {
            setupError = err instanceof Error ? err.message : "Failed to set up signing key";
        } finally {
            settingUpKey = false;
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
                needsMasterKey = true;
                masterKeyError = null;
                error = "";
                signing = false;
                return;
            }
            
            // Submit the signature to the server
            await api.signing.sign(request.id, signature);
            
            // Notify parent if embedded
            if (embed) {
                postToEmbedHost({
                    type: "ave:signed",
                    payload: {
                        requestId: request.id,
                        signature,
                        publicKey: signingKey.publicKey,
                    }
                });
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
                postToEmbedHost({
                    type: "ave:denied",
                    payload: { requestId: request.id }
                });
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
            if (redirectingToLogin) return;
            if (embedSheet) {
                if (!storageAccessAttempted) {
                    needsStorageAccess = false;
                    handleStorageAccessAuto();
                } else {
                    needsStorageAccess = true;
                }
                return;
            }
            setReturnUrl(window.location.pathname + window.location.search);
            redirectingToLogin = true;
            safeGoto(goto, "/login");
            return;
        }
        needsStorageAccess = false;
        loadRequest();
    });

    async function handleStorageAccessAuto() {
        if (requestingStorageAccess) return;
        storageAccessAttempted = true;
        requestingStorageAccess = true;
        storageAccessError = null;
        try {
            if (!supportsStorageAccessApi()) {
                const opened = openSigningPopupHere();
                if (!opened) {
                    storageAccessError = "Popup blocked. Allow popups to continue.";
                    needsStorageAccess = true;
                    return;
                }
                redirectingToLogin = true;
                needsStorageAccess = false;
                loading = true;
                return;
            }

            const alreadyHasAccess = (await withTimeout(hasStorageAccess(), 1200)) === true;
            const granted = alreadyHasAccess || (await withTimeout(requestStorageAccess(), 8000)) === true;
            if (!granted) {
                const opened = openSigningPopupHere();
                if (!opened) {
                    storageAccessError = "Popup blocked. Allow popups to continue.";
                    needsStorageAccess = true;
                    return;
                }
                redirectingToLogin = true;
                needsStorageAccess = false;
                loading = true;
                return;
            }

            const initOk = (await withTimeout(auth.init(), 5000)) !== null;
            if (!initOk) {
                const opened = openSigningPopupHere();
                if (!opened) {
                    storageAccessError = "Popup blocked. Allow popups to continue.";
                    needsStorageAccess = true;
                    return;
                }
                redirectingToLogin = true;
                needsStorageAccess = false;
                loading = true;
                return;
            }
            const authState = $isAuthenticated;
            if (!authState) {
                const opened = openSigningPopupHere();
                if (!opened) {
                    storageAccessError = "Popup blocked. Allow popups to continue.";
                    needsStorageAccess = true;
                    return;
                }
                redirectingToLogin = true;
                needsStorageAccess = false;
                loading = true;
                return;
            }

            needsStorageAccess = false;
        } finally {
            requestingStorageAccess = false;
        }
    }

    function handleStorageAccessContinue() {
        const opened = openSigningPopupHere();
        if (!opened) {
            storageAccessError = "Popup blocked. Allow popups to continue.";
            needsStorageAccess = true;
            return;
        }
        redirectingToLogin = true;
        needsStorageAccess = false;
        loading = true;
    }

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

    async function handleUnlockMasterKey() {
        if (unlockingMasterKey) return;
        unlockingMasterKey = true;
        masterKeyError = null;
        try {
            const result = await unlockMasterKeyWithPasskey();
            if (!result.ok) {
                masterKeyError = result.error;
                return;
            }
            needsMasterKey = false;
            await loadRequest();
        } finally {
            unlockingMasterKey = false;
        }
    }
</script>

{#if needsStorageAccess}
    <StorageAccessGate
        title="Open sign-in"
        message={storageAccessError || "We couldn't open the sign-in popup. Please allow popups and try again."}
        cta="Open sign-in"
        busy={requestingStorageAccess}
        onclick={handleStorageAccessContinue}
    />
{:else if needsMasterKey}
    <div class={embedSheet
        ? "w-full min-h-screen bg-[#111111]"
        : (embedPopup
            ? "fixed inset-0 bg-black flex items-end md:items-center justify-center z-50"
            : "fixed inset-0 bg-black/80 flex items-end md:items-center justify-center z-50 backdrop-blur-sm")}
    >
        <div class={embedSheet
            ? "w-full min-h-screen"
            : "w-full max-w-[600px] bg-[#111111] rounded-t-[32px] md:rounded-[32px] overflow-hidden animate-slide-up"}
        >
            <div class="p-8 md:p-12 flex flex-col items-center justify-center min-h-[300px] gap-6">
                <div class="w-[80px] h-[80px] rounded-full bg-[#E14747]/20 flex items-center justify-center">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 8V12M12 16H12.01" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="text-center">
                    <Text type="h" size={24} color="#FFFFFF">Encryption Key Required</Text>
                    <Text type="p" size={16} color="#878787">Unlock your encryption key to continue.</Text>
                </div>
                {#if masterKeyError}
                    <Text type="p" size={14} color="#E14747">{masterKeyError}</Text>
                {/if}
                <button
                    class="w-full max-w-[350px] py-[18px] bg-[#FFFFFF] text-[#090909] font-semibold rounded-[16px] hover:bg-[#E0E0E0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={unlockingMasterKey}
                    onclick={handleUnlockMasterKey}
                >
                    {unlockingMasterKey ? "Unlocking…" : "Unlock with Passkey"}
                </button>
            </div>
        </div>
    </div>
{:else}
<div class={embedSheet
    ? "w-full min-h-screen bg-[#111111]"
    : (embedPopup
        ? "fixed inset-0 bg-black flex items-end md:items-center justify-center z-50"
        : "fixed inset-0 bg-black/80 flex items-end md:items-center justify-center z-50 backdrop-blur-sm")}
>
    <!-- When embedded in the signing sheet iframe, fill the sheet container (no nested modal). -->
    <div class={embedSheet
        ? "w-full min-h-screen"
        : "w-full max-w-[600px] bg-[#111111] rounded-t-[32px] md:rounded-[32px] overflow-hidden animate-slide-up"}
    >
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
                    {#if identity.avatarUrl}
                        <img src={identity.avatarUrl} alt="" class="w-8 h-8 rounded-full object-cover" />
                    {:else}
                        <div class="w-8 h-8 rounded-full bg-[#222222] flex items-center justify-center">
                            <Text type="h" size={14} color="#FFFFFF">{identity.displayName[0]}</Text>
                        </div>
                    {/if}
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
                {#if needsSigningKey}
                    <div class="p-4 bg-[#0a0a0a] rounded-2xl border border-[#1f1f1f]">
                        <Text type="p" size={14} color="#B9BBBE">This identity doesn’t have a signing key yet.</Text>
                        <Text type="p" size={12} color="#666666" cclass="mt-1">We’ll generate one locally and store it encrypted.</Text>
                        {#if setupError}
                            <Text type="p" size={12} color="#E14747" cclass="mt-2">{setupError}</Text>
                        {/if}
                    </div>
                    <button
                        class="w-full py-4 bg-[#FFFFFF] text-[#000000] font-semibold rounded-2xl hover:bg-[#E0E0E0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        onclick={handleSetupSigningKey}
                        disabled={settingUpKey}
                    >
                        {#if settingUpKey}
                            <div class="w-5 h-5 border-2 border-[#000000] border-t-transparent rounded-full animate-spin"></div>
                        {:else}
                            Set Up Signing Key
                        {/if}
                    </button>
                    <button 
                        class="w-full py-4 bg-[#222222] text-[#878787] font-semibold rounded-2xl hover:bg-[#333333] hover:text-[#FFFFFF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onclick={handleDeny}
                        disabled={signing || settingUpKey}
                    >
                        Deny
                    </button>
                {:else}
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
                {/if}
            </div>
        {/if}
    </div>
</div>
{/if}

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
