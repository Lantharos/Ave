<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import ActionCard from "../../../components/ActionCard.svelte";
    import Passkey from "./components/Passkey.svelte";
    import { api } from "../../../lib/api";
    import { createDeletePasskeyMutation, createSecurityQuery, queryKeys } from "../../../lib/queries";
    import { queryClient } from "../../../lib/query-client";
    import { registerPasskey, authenticateWithPasskey, isPlatformAuthenticatorAvailable } from "../../../lib/webauthn";
    import { loadMasterKey, encryptMasterKeyWithPrf, createMasterKeyBackup } from "../../../lib/crypto";
    import { getPushStatus, subscribeToPushNotifications, unsubscribeFromPushNotifications, getPushSupportDetails } from "../../../lib/push";

    const securityQuery = createSecurityQuery();
    const deletePasskeyMutation = createDeletePasskeyMutation();

    let loading = $derived(securityQuery.isPending);
    let passkeys = $derived(securityQuery.data?.passkeys ?? []);
    let recoveryCodesRemaining = $derived(securityQuery.data?.recoveryCodesRemaining ?? 0);
    let hasRecoveryCodes = $derived(securityQuery.data?.hasRecoveryCodes ?? false);
    let error = $state<string | null>(null);
    let deletingPasskeyId = $state<string | null>(null);
    let addingPasskey = $state(false);
    let regeneratingCodes = $state(false);
    let issuingCodes = $state(false);
    let showNewCodes = $state(false);
    let newCodes = $state<string[]>([]);

    let pushSupported = $state(false);
    let pushPermission = $state<NotificationPermission>("default");
    let pushSubscribed = $state(false);
    let pushBusy = $state(false);
    let showPushPrompt = $state(false);
    let pushError = $state<string | null>(null);

    $effect(() => {
        if (!error && securityQuery.error) {
            error = securityQuery.error instanceof Error ? securityQuery.error.message : "Failed to load security data";
        }
    });

    async function handleDeletePasskey(passkeyId: string) {
        if (passkeys.length <= 1) {
            error = "Cannot delete your only passkey";
            return;
        }

        try {
            deletingPasskeyId = passkeyId;
            error = null;
            await deletePasskeyMutation.mutateAsync(passkeyId);
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to delete passkey";
        } finally {
            deletingPasskeyId = null;
        }
    }

    async function handleAddPasskey() {
        try {
            addingPasskey = true;
            error = null;

            const platformAuthenticatorAvailable = await isPlatformAuthenticatorAvailable();
            if (!platformAuthenticatorAvailable) {
                error = "This device can't create a passkey right now. Set up recovery codes here, then sign in on another device with Windows Hello or another passkey-capable device to add one there.";
                return;
            }
            
            const { options } = await api.security.registerPasskey();
            
            const { credential, prfSupported } = await registerPasskey(options);
            
            const result = await api.security.completePasskeyRegistration(
                credential, 
                "New Passkey"
            );
            
            queryClient.setQueryData<any>(queryKeys.security, (previous: any) => {
                if (!previous) return previous;
                return {
                    ...previous,
                    passkeys: [...previous.passkeys, result.passkey],
                };
            });
            
            if (prfSupported) {
                console.log("[Security] PRF supported, authenticating to get PRF output...");
                const masterKey = await loadMasterKey();
                
                if (masterKey) {
                    try {
                        const bytesToBase64url = (bytes: Uint8Array): string => {
                            const base64 = btoa(String.fromCharCode(...bytes));
                            return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                        };
                        
                        const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
                        const challenge = bytesToBase64url(challengeBytes);
                        
                        const credentialId = result.passkey.id;
                        
                        const authOptions = {
                            challenge,
                            rpId: window.location.hostname,
                            allowCredentials: [{
                                id: credentialId,
                                type: "public-key" as const,
                            }],
                            userVerification: "required",
                            timeout: 60000,
                        };
                        
                        const { prfOutput } = await authenticateWithPasskey(authOptions as any, true);
                        
                        if (prfOutput) {
                            const prfEncryptedMasterKey = await encryptMasterKeyWithPrf(masterKey, prfOutput);
                            console.log("[Security] Updating passkey with PRF-encrypted master key");
                            
                            await api.security.updatePasskeyPrf(result.passkey.id, prfEncryptedMasterKey);
                            console.log("[Security] PRF-encrypted master key saved successfully");
                        }
                    } catch (prfError) {
                        console.warn("[Security] Failed to set up PRF encryption:", prfError);
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === "NotAllowedError") {
                error = "Passkey setup was cancelled. You can try again, set up recovery codes here, or sign in on another device to add a passkey there.";
            } else {
                error = err instanceof Error ? err.message : "Failed to add passkey";
            }
        } finally {
            addingPasskey = false;
        }
    }

    async function finalizeRecoveryCodes(codes: string[]) {
        const masterKey = await loadMasterKey();
        if (!masterKey) {
            throw new Error("Your encryption key is not available on this device. Sign in on a trusted device before changing recovery codes.");
        }

        const encryptedBackup = await createMasterKeyBackup(masterKey, codes);
        await api.register.finalizeBackup(encryptedBackup);
    }

    async function handleIssueCodes() {
        try {
            issuingCodes = true;
            error = null;
            const result = await api.security.issueRecoveryCodes();
            await finalizeRecoveryCodes(result.codes);
            newCodes = result.codes;
            showNewCodes = true;
            await queryClient.invalidateQueries({ queryKey: queryKeys.security });
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to set up recovery codes";
        } finally {
            issuingCodes = false;
        }
    }

    async function handleRegenerateCodes() {
        if (!confirm("Are you sure? This will replace your current recovery codes.")) {
            return;
        }

        try {
            regeneratingCodes = true;
            error = null;
            const result = await api.security.regenerateTrustCodes();
            await finalizeRecoveryCodes(result.codes);
            newCodes = result.codes;
            showNewCodes = true;
            await queryClient.invalidateQueries({ queryKey: queryKeys.security });
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to regenerate codes";
        } finally {
            regeneratingCodes = false;
        }
    }

    async function loadPush() {
        try {
            const status = await getPushStatus();
            pushSupported = status.supported;
            pushPermission = status.permission;
            pushSubscribed = status.subscribed;
        } catch {
            pushSupported = false;
            pushPermission = "denied";
            pushSubscribed = false;
        }
    }

    function recoveryDescription(): string {
        if (!hasRecoveryCodes) {
            return "Create one-time recovery codes so you can get back in if you lose access to your passkeys.";
        }

        if (recoveryCodesRemaining === 0) {
            return "Your last set has been used up. Generate a new set before you need recovery again.";
        }

        return `Emergency access for when you lose your passkeys. You have ${recoveryCodesRemaining} one-time code(s) remaining.`;
    }

    function pushDescription(): string {
        if (!pushSupported) {
            if (typeof window !== "undefined" && !window.isSecureContext) {
                return "Push notifications require HTTPS (or localhost).";
            }
            const d = getPushSupportDetails();
            const missing: string[] = [];
            if (!d.hasNotification) missing.push("Notification API");
            if (!d.hasServiceWorker) missing.push("Service Worker");
            if (!d.hasPushManager) missing.push("Web Push");
            if (missing.length) {
                return `Push isn't available here (missing: ${missing.join(", ")}).`;
            }

            // Fallback: show the raw capability check so we can debug odd browsers.
            return `Push isn't available here (secure=${d.secureContext ? "yes" : "no"}, notif=${d.hasNotification ? "yes" : "no"}, sw=${d.hasServiceWorker ? "yes" : "no"}, push=${d.hasPushManager ? "yes" : "no"}).`;
        }
        if (pushSubscribed) return "Enabled for this device. We'll notify you about login approval requests.";
        if (pushPermission === "denied") return "Notifications are blocked in your browser settings for this site.";
        return "Get a notification when another device asks to log in.";
    }

    async function handlePushAction() {
        pushError = null;
        if (!pushSupported) return;

        if (pushSubscribed) {
            pushBusy = true;
            try {
                await unsubscribeFromPushNotifications();
                await loadPush();
            } catch (err) {
                pushError = err instanceof Error ? err.message : "Failed to disable notifications";
            } finally {
                pushBusy = false;
            }
            return;
        }

        if (pushPermission === "denied") {
            pushError = "Notifications are blocked for this site in your browser settings.";
            return;
        }

        // Only show the pre-permission prompt if the browser will actually ask.
        if (pushPermission === "default") {
            showPushPrompt = true;
            return;
        }

        // Permission already granted.
        await confirmEnablePush();
    }

    async function confirmEnablePush() {
        pushBusy = true;
        pushError = null;
        try {
            const ok = await subscribeToPushNotifications();
            if (!ok) {
                pushError = "Couldn't enable notifications. Check your browser permission prompt and try again.";
            }
            await loadPush();
        } catch (err) {
            pushError = err instanceof Error ? err.message : "Failed to enable notifications";
        } finally {
            pushBusy = false;
            showPushPrompt = false;
        }
    }

    $effect(() => {
        loadPush();
    });
</script>

<div class="flex flex-col gap-4 md:gap-[40px] w-full z-10 px-3 md:px-[60px] py-4 md:py-[40px] bg-[#111111]/60 rounded-[24px] md:rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-1 md:gap-[10px]">
        <Text type="h" size={48} mobileSize={28} weight="bold">Security</Text>
        <Text type="p" size={20} mobileSize={14}>Protect your Ave ID and the devices that can access it.</Text>
    </div>

    {#if error}
        <div class="bg-[#E14747]/20 border border-[#E14747] rounded-[16px] px-3 md:px-[20px] py-2 md:py-[15px]">
            <Text type="p" size={16} mobileSize={13} color="#E14747">{error}</Text>
        </div>
    {/if}

    <div class="flex flex-col gap-2 md:gap-[10px]">
        <div class="flex flex-col flex-grow bg-[#171717] p-3 md:p-[40px] rounded-[20px] md:rounded-[36px]">
            <Text type="h" size={24} mobileSize={18} weight="bold">Passkeys</Text>
            <p class="text-[#878787] text-sm md:text-[18px]">Passkeys are the main way you sign in. They stay tied to your devices and let Ave verify it’s really you.</p>
            <div class="flex flex-col gap-2 md:gap-[10px] mt-3 md:mt-[20px]">
                {#if loading}
                    <div class="flex justify-center py-3 md:py-[20px]">
                        <div class="w-[32px] h-[32px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                {:else if passkeys.length === 0}
                    <div class="text-center py-4 md:py-[20px]">
                        <Text type="p" size={16} color="#666666">No passkeys registered yet.</Text>
                    </div>
                {:else}
                    {#each passkeys as passkey (passkey.id)}
                        <Passkey 
                            {passkey} 
                            onDelete={handleDeletePasskey}
                            deleting={deletingPasskeyId === passkey.id}
                        />
                    {/each}
                {/if}
            </div>
        </div>

        <ActionCard 
            action="ADD A NEW PASSKEY" 
            description="Add a passkey to this device." 
            buttons={[
                { 
                    icon: "/icons/chevron-right-68.svg", 
                    color: "#FFFFFF", 
                    onClick: handleAddPasskey,
                    loading: addingPasskey 
                },
            ]}
        />
    </div>

    <div class="h-[1px] bg-[#202020] w-full"></div>

    <div class="flex flex-col gap-2 md:gap-[10px]">
        {#if hasRecoveryCodes}
            <ActionCard 
                action="RECOVERY CODES" 
                description={recoveryDescription()} 
                buttons={[
                    { 
                        icon: "/icons/refresh-56.svg", 
                        color: "#FFFFFF", 
                        onClick: handleRegenerateCodes,
                        loading: regeneratingCodes 
                    },
                ]} 
            />
        {:else}
            <ActionCard 
                action="SET UP RECOVERY" 
                description={recoveryDescription()} 
                buttons={[
                    { 
                        icon: "/icons/chevron-right-68.svg", 
                        color: "#FFFFFF", 
                        onClick: handleIssueCodes,
                        loading: issuingCodes 
                    },
                ]} 
            />
        {/if}
    </div>

    <div class="h-[1px] bg-[#202020] w-full"></div>

    {#if pushError}
        <div class="bg-[#E14747]/20 border border-[#E14747] rounded-[16px] px-3 md:px-[20px] py-2 md:py-[15px]">
            <Text type="p" size={16} mobileSize={13} color="#E14747">{pushError}</Text>
        </div>
    {/if}

    <div class="flex flex-col gap-2 md:gap-[10px]">
        <ActionCard 
            action={pushSubscribed ? "PUSH NOTIFICATIONS (ON)" : "PUSH NOTIFICATIONS"}
            description={pushDescription()}
            buttons={[
                {
                    icon: "/icons/chevron-right-68.svg",
                    color: "#FFFFFF",
                    onClick: handlePushAction,
                    loading: pushBusy,
                    disabled: !pushSupported,
                },
            ]}
        />
    </div>
</div>

{#if showPushPrompt}
    <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
        <div class="bg-[#171717] rounded-[24px] md:rounded-[36px] p-6 md:p-[40px] max-w-[520px] w-full">
            <Text type="h" size={24} weight="bold">Enable notifications?</Text>
            <p class="text-[#878787] text-sm md:text-[16px] mt-2 md:mt-[10px]">
                We'll ask your browser for permission next. If you allow it, Ave can notify this device when another device requests a login approval.
            </p>
            <div class="flex flex-row gap-2 md:gap-[10px] mt-6 md:mt-[30px]">
                <button 
                    class="flex-1 py-3 md:py-[15px] bg-[#222222] text-[#FFFFFF] font-semibold rounded-[16px] hover:bg-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onclick={() => { showPushPrompt = false; }}
                    disabled={pushBusy}
                >
                    Not now
                </button>
                <button 
                    class="flex-1 py-3 md:py-[15px] bg-[#FFFFFF] text-[#000000] font-semibold rounded-[16px] hover:bg-[#E0E0E0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    onclick={confirmEnablePush}
                    disabled={pushBusy}
                >
                    {#if pushBusy}
                        <div class="w-4 h-4 border-2 border-[#000000] border-t-transparent rounded-full animate-spin"></div>
                    {/if}
                    Enable
                </button>
            </div>
        </div>
    </div>
{/if}

{#if showNewCodes}
    <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
        <div class="bg-[#171717] rounded-[24px] md:rounded-[36px] p-6 md:p-[40px] max-w-[500px] w-full">
            <Text type="h" size={24} weight="bold">Recovery Codes</Text>
            <p class="text-[#878787] text-sm md:text-[16px] mt-2 md:mt-[10px]">
                Save these somewhere safe. Each code works once, and this set will not be shown again.
            </p>
            
            <div class="flex flex-col gap-2 md:gap-[10px] mt-4 md:mt-[20px]">
                {#each newCodes as code, index}
                    <div class="bg-[#111111] rounded-[16px] px-4 md:px-[20px] py-3 md:py-[15px] font-mono text-center">
                        <Text type="p" size={18} color="#FFFFFF">{index + 1}. {code}</Text>
                    </div>
                {/each}
            </div>

            <button 
                class="w-full mt-6 md:mt-[30px] bg-[#FFFFFF] text-[#000000] font-semibold py-3 md:py-[15px] rounded-[16px] hover:bg-[#E0E0E0] transition-colors"
                onclick={() => { showNewCodes = false; newCodes = []; }}
            >
                I've saved these codes
            </button>
        </div>
    </div>
{/if}
