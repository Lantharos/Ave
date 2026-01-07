<script lang="ts">
    import LoginMethods from "./pages/LoginMethods.svelte";
    import LoginStart from "./pages/LoginStart.svelte";
    import LoginTrustCode from "./pages/LoginTrustCode.svelte";
    import LoginWaiting from "./pages/LoginWaiting.svelte";
    import { goto } from "@mateothegreat/svelte5-router";
    import { auth, isAuthenticated } from "../../stores/auth";
    import type { Identity, Device } from "../../lib/api";
    import { onMount } from "svelte";

    let currentPage = $state<"login" | "methods" | "trust-code" | "waiting">("login");
    
    // Redirect to dashboard if already logged in
    onMount(() => {
        if ($isAuthenticated) {
            goto("/dashboard");
        }
    });
    let error = $state("");
    
    // State passed between steps
    let handle = $state("");
    let foundIdentity = $state<Identity | null>(null);
    let hasDevices = $state(false);
    let hasPasskeys = $state(false);
    let authOptions = $state<PublicKeyCredentialRequestOptions | null>(null);
    let authSessionId = $state<string | null>(null);
    let loginRequestId = $state<string | null>(null);
    let ephemeralKeyPair = $state<{ publicKey: string; privateKey: CryptoKey } | null>(null);
    
    // For passkey login without master key - we already authenticated but need the master key
    let pendingPasskeyLogin = $state<{ 
        sessionToken: string; 
        identities: Identity[]; 
        device: Device;
        prfSupported?: boolean;
        usedPasskeyId?: string;
        authOptions?: PublicKeyCredentialRequestOptions;
    } | null>(null);

    function handleLoginStart(data: {
        handle: string;
        identity: Identity;
        hasDevices: boolean;
        hasPasskeys: boolean;
        authOptions: PublicKeyCredentialRequestOptions | null;
        authSessionId: string | null;
    }) {
        handle = data.handle;
        foundIdentity = data.identity;
        hasDevices = data.hasDevices;
        hasPasskeys = data.hasPasskeys;
        authOptions = data.authOptions;
        authSessionId = data.authSessionId;
        currentPage = "methods";
    }

    function handleMethodSelect(method: "device" | "trust-code" | "passkey") {
        if (method === "trust-code") {
            currentPage = "trust-code";
        } else if (method === "device") {
            currentPage = "waiting";
        }
    }

    function handleLoginSuccess() {
        goto("/dashboard");
    }

    function setError(msg: string) {
        error = msg;
    }

    function clearError() {
        error = "";
    }
</script>

<div class="bg-[#090909] w-full h-screen-fixed flex flex-col items-center justify-center overflow-auto relative">
    {#if error}
        <div class="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-full z-50 backdrop-blur-sm">
            {error}
            <button class="ml-4 opacity-70 hover:opacity-100" onclick={clearError}>×</button>
        </div>
    {/if}

    {#if currentPage === "login"}
        <LoginStart onNext={handleLoginStart} onError={setError} />
    {:else if currentPage === "methods"}
        <LoginMethods 
            identity={foundIdentity}
            {hasDevices}
            {hasPasskeys}
            {authOptions}
            {authSessionId}
            {handle}
            onSelect={handleMethodSelect}
            onSuccess={handleLoginSuccess}
            onError={setError}
            bind:loginRequestId
            bind:ephemeralKeyPair
            bind:pendingPasskeyLogin
        />
    {:else if currentPage === "trust-code"}
        <LoginTrustCode 
            {handle}
            {pendingPasskeyLogin}
            onSuccess={handleLoginSuccess}
            onError={setError}
            onBack={() => { pendingPasskeyLogin = null; currentPage = "methods"; }}
        />
    {:else if currentPage === "waiting"}
        <LoginWaiting 
            {loginRequestId}
            {ephemeralKeyPair}
            onSuccess={handleLoginSuccess}
            onError={setError}
            onBack={() => currentPage = "methods"}
        />
    {/if}

    <img src="/grads/login_grad.png" class="absolute bottom-0 left-0 w-full h-auto pointer-events-none select-none" alt="gradient"/>
</div>
