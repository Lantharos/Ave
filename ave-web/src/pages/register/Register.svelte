<script lang="ts">
    import RegisterWelcome from "./pages/RegisterWelcome.svelte";
    import RegisterIdentity from "./pages/RegisterIdentity.svelte";
    import RegisterPasskey from "./pages/RegisterPasskey.svelte";
    import RegisterCodes from "./pages/RegisterCodes.svelte";
    import RegisterLegal from "./pages/RegisterLegal.svelte";
    import RegisterFinishing from "./pages/RegisterFinishing.svelte";
    import RegisterEnrollment from "./pages/RegisterEnrollment.svelte";
    import { onMount } from "svelte";
    import { preloadImages } from "../../util/helper";
    import { api } from "../../lib/api";
    import { 
        generateMasterKey, 
        createMasterKeyBackup,
        storeMasterKey,
        encryptMasterKeyWithPrf,
    } from "../../lib/crypto";
    import { registerPasskey, getDeviceInfo } from "../../lib/webauthn";
    import { auth, isAuthenticated } from "../../stores/auth";
    import { goto } from "@mateothegreat/svelte5-router";

    // Registration state
    let currentPage: keyof typeof pageBg = "welcome";
    let loaded = false;
    let error = "";
    
    // Get return URL if we came from login/authorize
    const returnUrl = new URLSearchParams(window.location.search).get("return");

    // Collected data across steps
    let identityData = {
        displayName: "",
        handle: "",
        email: "",
        birthday: "",
        avatarUrl: "",
        bannerUrl: "",
        bannerColor: "#FFFFFF",
    };

    let tempUserId = "";
    let webauthnOptions: PublicKeyCredentialCreationOptions | null = null;
    let webauthnCredential: Credential | null = null;
    let masterKey: CryptoKey | null = null;
    let trustCodes: string[] = [];
    
    // PRF extension data for encrypting master key with passkey
    let prfSupported = false;
    let prfOutput: ArrayBuffer | null = null;

    const pageBg = {
        welcome: "/grads/reg/reg_grad_welcome.png",
        identity: "/grads/reg/reg_grad_identity.png",
        passkey: "/grads/reg/reg_grad_passkey.png",
        codes: "/grads/reg/reg_grad_codes.png",
        legal: "/grads/reg/reg_grad_legal.png",
        setup: "/grads/reg/reg_grad_finishing.png",
        enrollment: "/grads/reg/reg_grad_enrollment.png",
    } as const;

    let bgA: string = pageBg[currentPage];
    let bgB = "";
    let showA = true;

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
        
        await preloadImages(Object.values(pageBg));
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
            
            // Store the real trust codes from server
            trustCodes = result.trustCodes;
            
            // Store master key and login
            await auth.login(
                result.sessionToken,
                [result.identity],
                result.device,
                masterKey
            );
            
            // Step 2: Now create the encrypted backup with REAL trust codes and send it to the server
            const encryptedBackup = await createMasterKeyBackup(masterKey, trustCodes);
            await api.register.finalizeBackup(encryptedBackup);
            
            console.log("[Registration] Master key backup finalized with real trust codes");
            
            // Go to codes page to show REAL trust codes
            setPage("codes");
        } catch (e: any) {
            error = e.message || "Registration failed. Please try again.";
            setPage("legal");
        }
    }

    function handleEnrollmentComplete() {
        // If we have a return URL (came from authorize flow), go back there
        if (returnUrl) {
            goto(returnUrl);
        } else {
            goto("/dashboard");
        }
    }
</script>

{#if loaded}
    <div class="relative w-full min-h-screen-fixed overflow-y-auto scroll-smooth bg-[#090909]">
        <div
                class="absolute bottom-0 inset-x-0 h-[700px] bg-center bg-cover transition-opacity duration-300 will-change-[opacity] select-none pointer-events-none transform-gpu"
                style={`background-image:url(${bgA})`}
                class:opacity-0={!showA}
        ></div>
        <div
                class="absolute bottom-0 inset-x-0 h-[700px] bg-center bg-cover transition-opacity duration-300 will-change-[opacity] select-none pointer-events-none transform-gpu"
                style={`background-image:url(${bgB})`}
                class:opacity-0={showA}
        ></div>

        <div class="relative z-10">
            {#if error}
                <div class="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-full z-50 backdrop-blur-sm">
                    {error}
                    <button class="ml-4 opacity-70 hover:opacity-100" onclick={() => error = ""}>×</button>
                </div>
            {/if}
            
            {#if currentPage === "welcome"}
                <RegisterWelcome onNext={() => setPage("identity")} />
            {:else if currentPage === "identity"}
                <RegisterIdentity 
                    initialData={identityData}
                    onNext={handleIdentityNext} 
                />
            {:else if currentPage === "passkey"}
                <RegisterPasskey onNext={handlePasskeySetup} />

            {:else if currentPage === "codes"}
                <RegisterCodes {trustCodes} onNext={() => setPage("enrollment")} />
            {:else if currentPage === "legal"}
                <RegisterLegal onNext={handleLegalAccept} />
            {:else if currentPage === "setup"}
                <RegisterFinishing />
            {:else if currentPage === "enrollment"}
                <RegisterEnrollment onComplete={handleEnrollmentComplete} />
            {/if}
        </div>
    </div>
{:else}
    <div class="bg-[#090909] w-full h-screen-fixed grid place-items-center">
        <div class="w-12 h-12 border-4 border-transparent border-t-white rounded-full animate-spin"></div>
    </div>
{/if}
