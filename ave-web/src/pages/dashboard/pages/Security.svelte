<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import ActionCard from "../../../components/ActionCard.svelte";
    import Passkey from "./components/Passkey.svelte";
    import { api, type Passkey as PasskeyType } from "../../../lib/api";
    import { registerPasskey, authenticateWithPasskey } from "../../../lib/webauthn";
    import { loadMasterKey, encryptMasterKeyWithPrf } from "../../../lib/crypto";

    let passkeys = $state<PasskeyType[]>([]);
    let trustCodesRemaining = $state(0);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let deletingPasskeyId = $state<string | null>(null);
    let addingPasskey = $state(false);
    let regeneratingCodes = $state(false);
    let showNewCodes = $state(false);
    let newCodes = $state<string[]>([]);

    async function loadSecurityData() {
        try {
            loading = true;
            error = null;
            const data = await api.security.get();
            passkeys = data.passkeys;
            trustCodesRemaining = data.trustCodesRemaining;
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load security data";
        } finally {
            loading = false;
        }
    }

    async function handleDeletePasskey(passkeyId: string) {
        if (passkeys.length <= 1) {
            error = "Cannot delete your only passkey";
            return;
        }

        try {
            deletingPasskeyId = passkeyId;
            error = null;
            await api.security.deletePasskey(passkeyId);
            passkeys = passkeys.filter(p => p.id !== passkeyId);
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
            
            // Get registration options from server
            const { options } = await api.security.registerPasskey();
            
            // Start WebAuthn registration with PRF support
            // Note: During registration, we only learn if PRF is supported, not the actual PRF output
            const { credential, prfSupported } = await registerPasskey(options);
            
            // Complete registration on server first
            const result = await api.security.completePasskeyRegistration(
                credential, 
                "New Passkey"
            );
            
            // Add to list immediately so user sees the new passkey
            passkeys = [...passkeys, result.passkey];
            
            // If PRF is supported, we need to authenticate with the passkey to get the PRF output
            // Then we can encrypt the master key and update the passkey record
            if (prfSupported) {
                console.log("[Security] PRF supported, authenticating to get PRF output...");
                const masterKey = await loadMasterKey();
                
                if (masterKey) {
                    try {
                        // Helper to convert bytes to base64url
                        const bytesToBase64url = (bytes: Uint8Array): string => {
                            const base64 = btoa(String.fromCharCode(...bytes));
                            return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                        };
                        
                        // Generate a random challenge as base64url
                        const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
                        const challenge = bytesToBase64url(challengeBytes);
                        
                        // The passkey ID is already base64url encoded from the server
                        const credentialId = result.passkey.id;
                        
                        // Create auth options in the format expected by @simplewebauthn/browser
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
                        
                        // Authenticate with PRF to get the output
                        const { prfOutput } = await authenticateWithPasskey(authOptions as any, true);
                        
                        if (prfOutput) {
                            // Encrypt the master key with PRF output
                            const prfEncryptedMasterKey = await encryptMasterKeyWithPrf(masterKey, prfOutput);
                            console.log("[Security] Updating passkey with PRF-encrypted master key");
                            
                            // Update the passkey record with the encrypted master key
                            await api.security.updatePasskeyPrf(result.passkey.id, prfEncryptedMasterKey);
                            console.log("[Security] PRF-encrypted master key saved successfully");
                        }
                    } catch (prfError) {
                        // PRF encryption failed, but the passkey was still registered successfully
                        console.warn("[Security] Failed to set up PRF encryption:", prfError);
                    }
                }
            }
        } catch (err) {
            if (err instanceof Error && err.name === "NotAllowedError") {
                error = "Passkey registration was cancelled";
            } else {
                error = err instanceof Error ? err.message : "Failed to add passkey";
            }
        } finally {
            addingPasskey = false;
        }
    }

    async function handleRegenerateCodes() {
        if (!confirm("Are you sure? This will invalidate your existing trust codes.")) {
            return;
        }

        try {
            regeneratingCodes = true;
            error = null;
            const result = await api.security.regenerateTrustCodes();
            newCodes = result.codes;
            trustCodesRemaining = result.codes.length;
            showNewCodes = true;
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to regenerate codes";
        } finally {
            regeneratingCodes = false;
        }
    }

    // Load data on mount
    $effect(() => {
        loadSecurityData();
    });
</script>

<div class="flex flex-col gap-[40px] w-full z-10 px-[60px] py-[40px] bg-[#111111]/60 rounded-[64px] backdrop-blur-[20px]">
    <div class="flex flex-col gap-[10px]">
        <Text type="h" size={48} weight="bold">Security</Text>
        <Text type="p" size={20}>Protect your Ave ID and the devices that can access it.</Text>
    </div>

    {#if error}
        <div class="bg-[#E14747]/20 border border-[#E14747] rounded-[16px] px-[20px] py-[15px]">
            <Text type="p" size={16} color="#E14747">{error}</Text>
        </div>
    {/if}

    <div class="flex flex-col gap-[10px]">
        <div class="flex flex-col flex-grow bg-[#171717] p-[40px] rounded-[36px]">
            <Text type="h" size={24} weight="bold">Passkeys</Text>
            <p class="text-[#878787] text-[18px]">Passkeys are unique, highly secure tokens that provide quick and convenient access to your account or services. They act as a trusted key to unlock your account, often used in scenarios such as account recovery or emergency access.</p>
            <div class="flex flex-col gap-[10px] mt-[20px]">
                {#if loading}
                    <div class="flex justify-center py-[20px]">
                        <div class="w-[32px] h-[32px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                {:else if passkeys.length === 0}
                    <div class="text-center py-[20px]">
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
                    icon: addingPasskey ? "" : "/icons/chevron-right-68.svg", 
                    color: "#FFFFFF", 
                    onClick: handleAddPasskey,
                    loading: addingPasskey 
                },
            ]}
        />
    </div>

    <div class="h-[1px] bg-[#202020] w-full"></div>

    <ActionCard action="SECURITY QUESTIONS" description="Answer security questions to help protect your account." buttons={[
       { icon: "/icons/pencil-56.svg", color: "#FFFFFF", onClick: () => {} },
    ]}/>

    <div class="flex flex-col gap-[10px]">
        <ActionCard 
            action="TRUST CODES" 
            description="Trust codes can be used to recover your account. You have {trustCodesRemaining} code(s)." 
            buttons={[
                { 
                    icon: regeneratingCodes ? "" : "/icons/refresh-56.svg", 
                    color: "#FFFFFF", 
                    onClick: handleRegenerateCodes,
                    loading: regeneratingCodes 
                },
            ]}
        />
    </div>
</div>

{#if showNewCodes}
    <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
        <div class="bg-[#171717] rounded-[36px] p-[40px] max-w-[500px] w-full mx-[20px]">
            <Text type="h" size={24} weight="bold">New Trust Codes</Text>
            <p class="text-[#878787] text-[16px] mt-[10px]">
                Save these codes in a secure place. They will not be shown again.
            </p>
            
            <div class="flex flex-col gap-[10px] mt-[20px]">
                {#each newCodes as code}
                    <div class="bg-[#111111] rounded-[16px] px-[20px] py-[15px] font-mono text-center">
                        <Text type="p" size={18} color="#FFFFFF">{code}</Text>
                    </div>
                {/each}
            </div>

            <button 
                class="w-full mt-[30px] bg-[#FFFFFF] text-[#000000] font-semibold py-[15px] rounded-[16px] hover:bg-[#E0E0E0] transition-colors"
                onclick={() => { showNewCodes = false; newCodes = []; }}
            >
                I've saved these codes
            </button>
        </div>
    </div>
{/if}
