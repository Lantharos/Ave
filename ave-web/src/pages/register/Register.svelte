<script lang="ts">
    import RegisterWelcome from "./pages/RegisterWelcome.svelte";
    import RegisterIdentity from "./pages/RegisterIdentity.svelte";
    import RegisterPasskey from "./pages/RegisterPasskey.svelte";
    import RegisterCodes from "./pages/RegisterCodes.svelte";
    import RegisterLegal from "./pages/RegisterLegal.svelte";
    import RegisterFinishing from "./pages/RegisterFinishing.svelte";
    import RegisterEnrollment from "./pages/RegisterEnrollment.svelte";
    import AuroraBackdrop from "../../components/AuroraBackdrop.svelte";
    import { onMount } from "svelte";
    import { api } from "../../lib/api";
    import { 
        generateMasterKey, 
        createMasterKeyBackup,
        encryptMasterKeyWithPrf,
    } from "../../lib/crypto";
    import { registerPasskey, getDeviceInfo } from "../../lib/webauthn";
    import { auth, isAuthenticated } from "../../stores/auth";
    import { getReturnUrl, clearReturnUrl } from "../../util/return-url";
    import { goto } from "@mateothegreat/svelte5-router";
    import { loadPendingAuthContext, type PendingAuthContext } from "../../util/auth-context";

    // Registration state
    let currentPage = $state<keyof typeof pageBg>("welcome");
    let loaded = $state(false);
    let error = $state("");
    
    // Collected data across steps
    let identityData = $state({
        displayName: "",
        handle: "",
        email: "",
        birthday: "",
        avatarUrl: "",
        bannerUrl: "",
        bannerColor: "#FFFFFF",
    });

    let tempUserId = "";
    let webauthnOptions: PublicKeyCredentialCreationOptions | null = null;
    let webauthnCredential: Credential | null = null;
    let masterKey: CryptoKey | null = null;
    let trustCodes = $state<string[]>([]);
    let isCompletingRegistration = $state(false);
    let isSettingUpRecovery = $state(false);
    let pendingAuthContext = $state<PendingAuthContext | null>(null);
    
    // PRF extension data for encrypting master key with passkey
    let prfSupported = false;
    let prfOutput: ArrayBuffer | null = null;

    const pageBg = {
        welcome: "reg-welcome",
        identity: "reg-identity",
        passkey: "reg-passkey",
        legal: "reg-legal",
        setup: "reg-finishing",
        enrollment: "reg-enrollment",
        codes: "reg-codes",
    } as const;

    let bgA = $state<typeof pageBg[keyof typeof pageBg]>(pageBg.welcome);
    let bgB = $state<typeof pageBg[keyof typeof pageBg] | "">("");
    let showA = $state(true);

    function setPage(page: keyof typeof pageBg) {
        const next = pageBg[page];
        if (!next) { currentPage = page; return; }
        if (showA) { bgB = next; showA = false; }
        else { bgA = next; showA = true; }
        currentPage = page;
        error = "";
    }

    onMount(async () => {
        // Redirect to dashboard if already logged in
        if ($isAuthenticated) {
            goto("/dashboard");
            return;
        }

        pendingAuthContext = await loadPendingAuthContext();
        
        // No image preloads needed for blob backdrops
        loaded = true;
    });

    // Step handlers
    async function handleIdentityNext(data: typeof identityData) {
        identityData = data;
        
        try {
            // Check if handle is available
            const { available, reason } = await api.register.checkHandle(data.handle);
            if (!available) {
                error = reason || "Handle is already taken";
                return;
            }
            
            // Start registration to get WebAuthn options
            const result = await api.register.start(data.handle);
            tempUserId = result.tempUserId;
            webauthnOptions = result.options;
            
            setPage("passkey");
        } catch (e: any) {
            error = e.message || "Failed to check handle availability";
        }
    }

    async function handlePasskeySetup() {
        if (!webauthnOptions) {
            error = "No passkey options available. Please go back and try again.";
            return;
        }
        
        try {
            const result = await registerPasskey(webauthnOptions);
            webauthnCredential = result.credential;
            prfSupported = result.prfSupported;
            prfOutput = result.prfOutput || null;
            
            console.log("[Registration] Passkey registered, PRF supported:", prfSupported);
            
            // Generate master key and go to legal step (skipping security questions)
            masterKey = await generateMasterKey();
            setPage("legal");
        } catch (e: any) {
            console.error("Passkey registration failed:", e);
            error = "Failed to set up passkey. Please try again.";
        }
    }

    async function handleLegalAccept() {
        if (isCompletingRegistration) return;
        isCompletingRegistration = true;
        setPage("setup");
        await completeRegistration();
    }

    async function completeRegistration() {
        if (!webauthnCredential || !masterKey) {
            error = "Missing required data. Please start over.";
            setPage("welcome");
            return;
        }
        
        try {
            const deviceInfo = getDeviceInfo();
            
            // If PRF is supported, encrypt the master key with PRF output
            let prfEncryptedMasterKey: string | undefined;
            if (prfSupported && prfOutput) {
                prfEncryptedMasterKey = await encryptMasterKeyWithPrf(masterKey, prfOutput);
                console.log("[Registration] Master key encrypted with PRF");
            }
            
            // Step 1: Complete registration
            const result = await api.register.complete({
                tempUserId,
                credential: webauthnCredential,
                identity: {
                    displayName: identityData.displayName,
                    handle: identityData.handle,
                    email: identityData.email || undefined,
                    birthday: identityData.birthday || undefined,
                    avatarUrl: identityData.avatarUrl || undefined,
                    bannerUrl: identityData.bannerUrl || undefined,
                },

                device: deviceInfo,
                prfEncryptedMasterKey, // Send PRF-encrypted master key if available
            });
            
            // Store master key and login
            await auth.login(
                result.sessionToken,
                [result.identity],
                result.device,
                masterKey
            );
            
            setPage("enrollment");
        } catch (e: any) {
            error = e.message || "Registration failed. Please try again.";
            setPage("legal");
        } finally {
            isCompletingRegistration = false;
        }
    }

    function handleEnrollmentComplete() {
        // If we have a return URL (stored for this session), go back there
        const returnUrl = getReturnUrl();
        if (returnUrl) {
            clearReturnUrl();
            goto(returnUrl);
            return;
        }
        goto("/dashboard");
    }

    async function handleRecoverySetup() {
        if (!masterKey || isSettingUpRecovery) {
            return;
        }

        try {
            isSettingUpRecovery = true;
            error = "";

            const result = await api.security.issueRecoveryCodes();
            trustCodes = result.codes;

            const encryptedBackup = await createMasterKeyBackup(masterKey, result.codes);
            await api.register.finalizeBackup(encryptedBackup);

            setPage("codes");
        } catch (e: any) {
            error = e.message || "Failed to set up recovery.";
        } finally {
            isSettingUpRecovery = false;
        }
    }
</script>

{#if loaded}
    <div class="relative w-full min-h-screen-fixed overflow-y-auto hide-scrollbar scroll-smooth bg-[#090909]">
        <AuroraBackdrop
                preset={bgA}
                cclass={`absolute bottom-0 inset-x-0 h-[700px] transition-opacity duration-300 will-change-[opacity] select-none pointer-events-none transform-gpu ${!showA ? "opacity-0" : ""}`}
        />
        <AuroraBackdrop
                preset={bgB || bgA}
                cclass={`absolute bottom-0 inset-x-0 h-[700px] transition-opacity duration-300 will-change-[opacity] select-none pointer-events-none transform-gpu ${showA ? "opacity-0" : ""}`}
        />

        <div class="relative z-10">
            {#if error}
                <div class="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-full z-50 backdrop-blur-sm">
                    {error}
                    <button class="ml-4 opacity-70 hover:opacity-100" onclick={() => error = ""}>×</button>
                </div>
            {/if}
            
            {#if currentPage === "welcome"}
                <RegisterWelcome
                    onNext={() => setPage("identity")}
                    appName={pendingAuthContext?.appName ?? null}
                    appIconUrl={pendingAuthContext?.appIconUrl ?? null}
                />
            {:else if currentPage === "identity"}
                <RegisterIdentity 
                    initialData={identityData}
                    onNext={handleIdentityNext} 
                />
            {:else if currentPage === "passkey"}
                <RegisterPasskey onNext={handlePasskeySetup} appName={pendingAuthContext?.appName ?? null} />

            {:else if currentPage === "codes"}
                <RegisterCodes {trustCodes} onNext={handleEnrollmentComplete} />
            {:else if currentPage === "legal"}
                <RegisterLegal onNext={handleLegalAccept} disabled={isCompletingRegistration} />
            {:else if currentPage === "setup"}
                <RegisterFinishing />
            {:else if currentPage === "enrollment"}
                <RegisterEnrollment
                    onComplete={handleEnrollmentComplete}
                    onSetupRecovery={handleRecoverySetup}
                    settingUpRecovery={isSettingUpRecovery}
                />
            {/if}
        </div>
    </div>
{:else}
    <div class="bg-[#090909] w-full h-screen-fixed grid place-items-center">
        <div class="w-12 h-12 border-4 border-transparent border-t-white rounded-full animate-spin"></div>
    </div>
{/if}
