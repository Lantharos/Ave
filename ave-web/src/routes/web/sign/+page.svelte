<script lang="ts">
import Text from "$lib/surfaces/web/components/Text.svelte";
import StorageAccessGate from "$lib/surfaces/web/components/StorageAccessGate.svelte";
import { createSigningFlow } from "./signing-flow.svelte";
const flow = createSigningFlow();
</script>

{#if flow.needsStorageAccess}
    <StorageAccessGate
        title={`Continue signing for ${flow.app?.name || "this app"}`}
        message={flow.storageAccessError || `We'll open a secure browser page so you can finish this request for ${flow.app?.name || "this app"} and come right back.`}
        cta="Continue in browser"
        busy={flow.requestingStorageAccess}
        iconUrl={flow.app?.iconUrl || null}
        onclick={flow.handleStorageAccessContinue}
    />
{:else if flow.needsMasterKey}
    <div class={flow.embedSheet
        ? "w-full min-h-screen bg-[#111111]"
        : (flow.embedPopup
            ? "fixed inset-0 bg-black flex items-end md:items-center justify-center z-50"
            : "fixed inset-0 bg-black/80 flex items-end md:items-center justify-center z-50 backdrop-blur-sm")}
    >
        <div class={flow.embedSheet
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
                {#if flow.masterKeyError}
                    <Text type="p" size={14} color="#E14747">{flow.masterKeyError}</Text>
                {/if}
                <button
                    class="w-full max-w-[350px] py-[18px] bg-[#FFFFFF] text-[#090909] font-semibold rounded-[16px] hover:bg-[#E0E0E0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={flow.unlockingMasterKey}
                    onclick={flow.handleUnlockMasterKey}
                >
                    {flow.unlockingMasterKey ? "Unlocking…" : "Unlock with Passkey"}
                </button>
            </div>
        </div>
    </div>
{:else}
<div class={flow.embedSheet
    ? "w-full min-h-screen bg-[#111111]"
    : (flow.embedPopup
        ? "fixed inset-0 bg-black flex items-end md:items-center justify-center z-50"
        : "fixed inset-0 bg-black/80 flex items-end md:items-center justify-center z-50 backdrop-blur-sm")}
>
    <!-- When embedded in the signing sheet iframe, fill the sheet container (no nested modal). -->
    <div class={flow.embedSheet
        ? "w-full min-h-screen"
        : "w-full max-w-[600px] bg-[#111111] rounded-t-[32px] md:rounded-[32px] overflow-hidden animate-slide-up"}
    >
        {#if flow.loading}
            <div class="p-8 md:p-12 flex items-center justify-center min-h-[300px]">
                <div class="w-[48px] h-[48px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
            </div>
        {:else if flow.request?.status === "signed"}
            <div class="p-8 md:p-12 flex flex-col items-center justify-center min-h-[300px] gap-6">
                <div class="w-[80px] h-[80px] rounded-full bg-[#32A94C]/20 flex items-center justify-center">
                    <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 13L9 17L19 7" stroke="#32A94C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <Text type="h" size={24} weight="bold" color="#32A94C">Signed Successfully</Text>
                <Text type="p" size={16} color="#878787">This window will close automatically.</Text>
            </div>
        {:else if flow.request?.status === "denied"}
            <div class="p-8 md:p-12 flex flex-col items-center justify-center min-h-[300px] gap-6">
                <div class="w-[80px] h-[80px] rounded-full bg-[#E14747]/20 flex items-center justify-center">
                    <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 18L18 6M6 6L18 18" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <Text type="h" size={24} weight="bold" color="#E14747">Request Denied</Text>
                <Text type="p" size={16} color="#878787">This window will close automatically.</Text>
            </div>
        {:else if flow.error}
            <div class="p-8 md:p-12 flex flex-col items-center justify-center min-h-[300px] gap-6">
                <div class="w-[80px] h-[80px] rounded-full bg-[#E14747]/20 flex items-center justify-center">
                    <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 9V13M12 17H12.01M12 3L3 20H21L12 3Z" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <Text type="h" size={24} weight="bold" color="#E14747">Error</Text>
                <Text type="p" size={16} color="#878787" cclass="text-center">{flow.error}</Text>
                <button
                    class="px-6 py-3 bg-[#222222] hover:bg-[#333333] rounded-full text-[#FFFFFF] transition-colors"
                    onclick={() => window.close()}
                >
                    Close
                </button>
            </div>
        {:else if flow.request && flow.app && flow.identity}
            <!-- Header -->
            <div class="p-6 md:p-8 border-b border-[#222222]">
                <div class="flex items-center gap-4">
                    {#if flow.app.iconUrl}
                        <img src={flow.app.iconUrl} alt="{flow.app.name}" class="w-12 h-12 md:w-16 md:h-16 rounded-2xl"/>
                    {:else}
                        <div class="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-[#222222] flex items-center justify-center">
                            <Text type="h" size={24} color="#878787">{flow.app.name[0]}</Text>
                        </div>
                    {/if}
                    <div class="flex-1">
                        <Text type="h" size={20} mobileSize={18} weight="bold">{flow.app.name}</Text>
                        <Text type="p" size={14} color="#878787">wants you to sign a message</Text>
                    </div>
                </div>
            </div>

            <!-- Identity -->
            <div class="px-6 md:px-8 py-4 bg-[#0a0a0a]">
                <Text type="p" size={12} color="#666666" cclass="uppercase tracking-wider mb-2">Signing as</Text>
                <div class="flex items-center gap-3">
                    {#if flow.identity.avatarUrl}
                        <img src={flow.identity.avatarUrl} alt="" class="w-8 h-8 rounded-full object-cover" />
                    {:else}
                        <div class="w-8 h-8 rounded-full bg-[#222222] flex items-center justify-center">
                            <Text type="h" size={14} color="#FFFFFF">{flow.identity.displayName[0]}</Text>
                        </div>
                    {/if}
                    <div>
                        <Text type="p" size={16} weight="semibold">{flow.identity.displayName}</Text>
                        <Text type="p" size={12} color="#878787">@{flow.identity.handle}</Text>
                    </div>
                </div>
            </div>

            <!-- Payload -->
            <div class="p-6 md:p-8">
                <Text type="p" size={12} color="#666666" cclass="uppercase tracking-wider mb-3">Message to sign</Text>
                <div class="bg-[#0a0a0a] rounded-2xl p-4 max-h-[200px] overflow-y-auto">
                    <pre class="text-[#FFFFFF] text-sm font-mono whitespace-pre-wrap break-words">{flow.formatPayload(flow.request.payload)}</pre>
                </div>

                {#if flow.request.metadata && Object.keys(flow.request.metadata).length > 0}
                    <div class="mt-4">
                        <Text type="p" size={12} color="#666666" cclass="uppercase tracking-wider mb-2">Additional info</Text>
                        <div class="flex flex-wrap gap-2">
                            {#each Object.entries(flow.request.metadata) as [key, value] (key)}
                                <span class="px-3 py-1 bg-[#222222] rounded-full text-[#878787] text-xs">
                                    {key}: {String(value)}
                                </span>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if flow.isExpired()}
                    <div class="mt-4 p-3 bg-[#E14747]/20 border border-[#E14747] rounded-xl">
                        <Text type="p" size={14} color="#E14747">This request has expired.</Text>
                    </div>
                {/if}
            </div>

            <!-- Actions -->
            <div class="p-6 md:p-8 pt-0 flex flex-col gap-3">
                {#if flow.needsSigningKey}
                    <div class="p-4 bg-[#0a0a0a] rounded-2xl border border-[#1f1f1f]">
                        <Text type="p" size={14} color="#B9BBBE">This identity doesn’t have a signing key yet.</Text>
                        <Text type="p" size={12} color="#666666" cclass="mt-1">We’ll generate one locally and store it encrypted.</Text>
                        {#if flow.setupError}
                            <Text type="p" size={12} color="#E14747" cclass="mt-2">{flow.setupError}</Text>
                        {/if}
                    </div>
                    <button
                        class="w-full py-4 bg-[#FFFFFF] text-[#000000] font-semibold rounded-2xl hover:bg-[#E0E0E0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        onclick={flow.handleSetupSigningKey}
                        disabled={flow.settingUpKey}
                    >
                        {#if flow.settingUpKey}
                            <div class="w-5 h-5 border-2 border-[#000000] border-t-transparent rounded-full animate-spin"></div>
                        {:else}
                            Set Up Signing Key
                        {/if}
                    </button>
                    <button
                        class="w-full py-4 bg-[#222222] text-[#878787] font-semibold rounded-2xl hover:bg-[#333333] hover:text-[#FFFFFF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onclick={flow.handleDeny}
                        disabled={flow.signing || flow.settingUpKey}
                    >
                        Deny
                    </button>
                {:else}
                    <button
                        class="w-full py-4 bg-[#FFFFFF] text-[#000000] font-semibold rounded-2xl hover:bg-[#E0E0E0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                        onclick={flow.handleSign}
                        disabled={flow.signing || flow.isExpired()}
                    >
                        {#if flow.signing}
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
                        onclick={flow.handleDeny}
                        disabled={flow.signing}
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
