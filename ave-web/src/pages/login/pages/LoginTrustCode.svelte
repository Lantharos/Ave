<script lang="ts">
    import Button from "../../../components/Button.svelte";
    import Text from "../../../components/Text.svelte";
    import { api, type Identity, type Device } from "../../../lib/api";
    import { recoverMasterKeyFromBackup, storeMasterKey, encryptMasterKeyWithPrf } from "../../../lib/crypto";
    import { getDeviceInfo, authenticateWithPasskey } from "../../../lib/webauthn";
    import { auth } from "../../../stores/auth";

    let { handle, pendingPasskeyLogin, onSuccess, onError, onBack } = $props<{
        handle: string;
        pendingPasskeyLogin?: { 
            sessionToken: string; 
            identities: Identity[]; 
            device: Device;
            prfSupported?: boolean;
            usedPasskeyId?: string;
            authOptions?: PublicKeyCredentialRequestOptions;
        } | null;
        onSuccess?: () => void;
        onError?: (error: string) => void;
        onBack?: () => void;
    }>();

    // If we have a pending passkey login, we already authenticated - just need master key
    let isRecoveryMode = $derived(!!pendingPasskeyLogin);

    let code = $state("");
    let isLoading = $state(false);

    async function handleSubmit() {
        if (!code.trim()) {
            onError?.("Please enter your trust code");
            return;
        }

        isLoading = true;
        try {
            if (isRecoveryMode && pendingPasskeyLogin) {
                // We already logged in via passkey, just need to recover master key
                // Use the dedicated recover-key endpoint (doesn't create new session/device)
                const result = await api.login.recoverKey({
                    handle,
                    code: code.trim(),
                });

                const masterKey = await recoverMasterKeyFromBackup(
                    result.encryptedMasterKeyBackup,
                    code.trim()
                );
                
                if (masterKey) {
                    await storeMasterKey(masterKey);
                    
                    // If PRF was supported during login, set it up now so future logins don't need trust codes
                    if (pendingPasskeyLogin.prfSupported && pendingPasskeyLogin.usedPasskeyId && pendingPasskeyLogin.authOptions) {
                        console.log("[Login] PRF supported, setting up PRF encryption for passkey...");
                        try {
                            // Re-authenticate with the same passkey to get PRF output
                            const { prfOutput } = await authenticateWithPasskey(pendingPasskeyLogin.authOptions, true);
                            
                            if (prfOutput) {
                                // Encrypt the master key with PRF
                                const prfEncryptedMasterKey = await encryptMasterKeyWithPrf(masterKey, prfOutput);
                                
                                // Update the passkey record with the encrypted master key
                                await api.security.updatePasskeyPrf(pendingPasskeyLogin.usedPasskeyId, prfEncryptedMasterKey);
                                console.log("[Login] PRF encryption set up successfully - future logins won't need trust codes");
                            }
                        } catch (prfError) {
                            // PRF setup failed, but login still succeeded
                            console.warn("[Login] Failed to set up PRF encryption:", prfError);
                        }
                    }
                    
                    // Use the existing passkey login session
                    await auth.login(
                        pendingPasskeyLogin.sessionToken,
                        pendingPasskeyLogin.identities,
                        pendingPasskeyLogin.device,
                        masterKey
                    );
                    onSuccess?.();
                } else {
                    onError?.("Failed to recover encryption key. Please check your trust code.");
                }
            } else {
                // Normal trust code login flow
                const deviceInfo = getDeviceInfo();
                const result = await api.login.trustCode({
                    handle,
                    code: code.trim(),
                    device: deviceInfo,
                });

                // Try to recover master key from backup
                if (result.encryptedMasterKeyBackup) {
                    const masterKey = await recoverMasterKeyFromBackup(
                        result.encryptedMasterKeyBackup,
                        code.trim()
                    );
                    
                    if (masterKey) {
                        // Store the recovered master key locally
                        await storeMasterKey(masterKey);
                        await auth.login(
                            result.sessionToken,
                            result.identities,
                            result.device,
                            masterKey
                        );
                    } else {
                        // Login succeeded but couldn't recover master key
                        await auth.login(
                            result.sessionToken,
                            result.identities,
                            result.device
                        );
                    }
                } else {
                    await auth.login(
                        result.sessionToken,
                        result.identities,
                        result.device
                    );
                }

                onSuccess?.();
            }
        } catch (e: any) {
            onError?.(e.message || "Invalid trust code");
        } finally {
            isLoading = false;
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && code.trim()) {
            handleSubmit();
        }
    }
</script>

<div class="w-full md:w-[50%] h-auto flex flex-col items-center z-10 gap-5 md:gap-[30px] px-4 md:px-0">
    <div class="text-center">
        {#if isRecoveryMode}
            <h1 class="font-black text-2xl md:text-[36px] text-[#FFFFFF]/80">RECOVER ENCRYPTION KEY</h1>
            <p class="text-[#878787] text-sm md:text-base mt-2">
                Enter a trust code to restore your encryption key on this device.
            </p>
        {:else}
            <h1 class="font-black text-2xl md:text-[36px] text-[#FFFFFF]/80">ENTER YOUR TRUST CODE</h1>
            <p class="text-[#878787] text-sm md:text-base mt-2">
                Enter one of your backup trust codes to sign in.
            </p>
        {/if}
    </div>

    {#if isRecoveryMode}
        <div class="p-4 md:p-[20px] bg-[#32A94C]/20 border border-[#32A94C] rounded-[16px] flex items-center gap-3 md:gap-[15px]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#32A94C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p class="text-[#32A94C] text-xs md:text-[14px]">Passkey verified! Just need your encryption key.</p>
        </div>
    {/if}

    <div class="w-full p-5 md:p-[30px] bg-[#171717]/80 rounded-[24px] md:rounded-[32px]">
        <Text type="hd" size={16} color="#878787">TRUST CODE</Text>
        <input 
            type="text" 
            class="w-full bg-[#111111] rounded-full mt-2 md:mt-[10px] px-4 md:px-[20px] py-3 md:py-[15px] text-white focus:outline-none font-mono text-base md:text-lg tracking-wider"
            placeholder="XXXXX-XXXXX-XXXXX"
            bind:value={code}
            onkeydown={handleKeydown}
            disabled={isLoading}
        />
        <p class="text-[#555] text-xs md:text-sm mt-2">
            Trust codes can be reused and never expire.
        </p>
    </div>

    <div class="flex flex-col w-full gap-3">
        <Button 
            text={isLoading ? "VERIFYING..." : (isRecoveryMode ? "RECOVER KEY" : "SIGN IN")}
            icon="/icons/chevronbk-right-38.svg"
            onclick={handleSubmit}
            disabled={!code.trim() || isLoading}
        />
        
        <button 
            class="w-full px-[20px] py-[15px] text-[#878787] hover:text-white transition-colors rounded-full"
            onclick={onBack}
            disabled={isLoading}
        >
            Back to other options
        </button>
    </div>
</div>
