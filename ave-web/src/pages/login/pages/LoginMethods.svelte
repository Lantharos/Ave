<script lang="ts">
    import ActionCard from "../../../components/ActionCard.svelte";
    import IdentityCard from "../../../components/IdentityCard.svelte";
    import Text from "../../../components/Text.svelte";
    import { api, type Identity } from "../../../lib/api";
    import { 
        generateEphemeralKeyPair, 
        hasMasterKey, 
        decryptMasterKeyWithPrf, 
        storeMasterKey 
    } from "../../../lib/crypto";
    import { authenticateWithPasskey, getDeviceInfo } from "../../../lib/webauthn";
    import { auth } from "../../../stores/auth";

    let { 
        identity,
        hasDevices,
        hasPasskeys,
        authOptions,
        authSessionId,
        handle,
        onSelect,
        onSuccess,
        onError,
        loginRequestId = $bindable(null),
        ephemeralKeyPair = $bindable(null),
        pendingPasskeyLogin = $bindable(null),
    } = $props<{
        identity: Identity | null;
        hasDevices: boolean;
        hasPasskeys: boolean;
        authOptions: PublicKeyCredentialRequestOptions | null;
        authSessionId: string | null;
        handle: string;
        onSelect?: (method: "device" | "trust-code" | "passkey") => void;
        onSuccess?: () => void;
        onError?: (error: string) => void;
        loginRequestId?: string | null;
        ephemeralKeyPair?: { publicKey: string; privateKey: CryptoKey } | null;
        pendingPasskeyLogin?: { sessionToken: string; identities: Identity[]; device: any } | null;
    }>();

    let isLoading = $state(false);
    let loadingMethod = $state<"passkey" | "device" | null>(null);

    async function handlePasskeyLogin() {
        if (!authOptions || !authSessionId) {
            onError?.("Passkey not available");
            return;
        }

        isLoading = true;
        loadingMethod = "passkey";
        try {
            // Request PRF extension during authentication to potentially decrypt master key
            const { credential, prfOutput } = await authenticateWithPasskey(authOptions, true);
            const deviceInfo = getDeviceInfo();
            
            const result = await api.login.passkey({
                authSessionId,
                credential,
                device: deviceInfo,
            });

            // Check if we have the master key locally
            if (hasMasterKey()) {
                // Great, we have the master key - complete login normally
                await auth.login(
                    result.sessionToken,
                    result.identities,
                    result.device
                );
                onSuccess?.();
            } else if (prfOutput && result.prfEncryptedMasterKey) {
                // PRF is available and we have the encrypted master key from server
                // Decrypt and store the master key
                try {
                    const masterKey = await decryptMasterKeyWithPrf(
                        result.prfEncryptedMasterKey,
                        prfOutput
                    );
                    await storeMasterKey(masterKey);
                    console.log("[Login] Master key recovered via PRF");
                    
                    await auth.login(
                        result.sessionToken,
                        result.identities,
                        result.device,
                        masterKey
                    );
                    onSuccess?.();
                } catch (prfError) {
                    console.error("[Login] PRF decryption failed:", prfError);
                    // PRF decryption failed, fall back to trust codes
                    pendingPasskeyLogin = {
                        sessionToken: result.sessionToken,
                        identities: result.identities,
                        device: result.device,
                    };
                    onSelect?.("trust-code");
                }
            } else {
                // No master key and no PRF - need to recover via trust code
                pendingPasskeyLogin = {
                    sessionToken: result.sessionToken,
                    identities: result.identities,
                    device: result.device,
                };
                onSelect?.("trust-code");
            }
        } catch (e: any) {
            onError?.(e.message || "Passkey verification failed");
        } finally {
            isLoading = false;
            loadingMethod = null;
        }
    }

    async function handleDeviceApproval() {
        isLoading = true;
        loadingMethod = "device";
        try {
            // Generate ephemeral key pair for secure key transfer
            const keyPair = await generateEphemeralKeyPair();
            ephemeralKeyPair = keyPair;
            
            const deviceInfo = getDeviceInfo();
            const result = await api.login.requestApproval({
                handle,
                requesterPublicKey: keyPair.publicKey,
                device: deviceInfo,
            });

            loginRequestId = result.requestId;
            onSelect?.("device");
        } catch (e: any) {
            onError?.(e.message || "Failed to request device approval");
        } finally {
            isLoading = false;
            loadingMethod = null;
        }
    }

    function handleTrustCode() {
        onSelect?.("trust-code");
    }
</script>

<div class="w-[60%] h-auto flex flex-col items-center z-10 gap-[50px]">
    <h1 class="font-black text-[36px] text-[#FFFFFF]/80">PROVE IT'S YOU</h1>
    
    {#if identity}
        <div class="flex items-center gap-6 p-8 bg-[#171717]/80 rounded-[32px]">
            <img 
                src={identity.avatarUrl || "/placeholder.png"} 
                alt="Avatar" 
                class="w-20 h-20 rounded-full object-cover"
            />
            <div>
                <p class="text-white font-bold text-2xl">{identity.displayName}</p>
                <p class="text-[#878787] text-lg">@{identity.handle}</p>
            </div>
        </div>
    {/if}

    <div class="flex flex-col w-full gap-[10px]">
        {#if hasPasskeys && authOptions}
            <ActionCard 
                action="USE PASSKEY" 
                description="Verify with your fingerprint, face, or security key." 
                buttons={[
                    { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: handlePasskeyLogin, loading: loadingMethod === "passkey" },
                ]} 
            />
        {/if}

        {#if hasDevices}
            <ActionCard 
                action="CONFIRM ON A TRUSTED DEVICE" 
                description="Approve this login on one of your other devices." 
                buttons={[
                    { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: handleDeviceApproval, loading: loadingMethod === "device" },
                ]} 
            />
        {/if}

        <ActionCard 
            action="USE TRUST CODES" 
            description="Enter your trust codes to sign in." 
            buttons={[
                { icon: "/icons/chevron-right-68.svg", color: "#FFFFFF", onClick: handleTrustCode },
            ]} 
        />
    </div>
</div>
