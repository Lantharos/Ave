<script lang="ts">
    import IdentityCard from "../../components/IdentityCard.svelte";
    import Text from "../../components/Text.svelte";
    import { api, type Identity } from "../../lib/api";
    import { generateAppKey, encryptAppKey, exportAppKey, loadMasterKey, decryptAppKey, hasMasterKey } from "../../lib/crypto";
    import { auth, isAuthenticated, identities as identitiesStore, currentIdentity } from "../../stores/auth";
    import { goto } from "@mateothegreat/svelte5-router";
    import { get } from "svelte/store";

    // Parse query params from window.location
    let querystring = $state(window.location.search.slice(1));
    
    // Update querystring when URL changes
    $effect(() => {
        const updateQuery = () => {
            querystring = window.location.search.slice(1);
        };
        window.addEventListener('popstate', updateQuery);
        return () => window.removeEventListener('popstate', updateQuery);
    });

    // Parse query params
    let params = $derived.by(() => {
        const searchParams = new URLSearchParams(querystring || "");
        const codeChallenge = searchParams.get("code_challenge");
        const codeChallengeMethod = searchParams.get("code_challenge_method");
        
        return {
            clientId: searchParams.get("client_id") || "",
            redirectUri: searchParams.get("redirect_uri") || "",
            scope: searchParams.get("scope") || "openid profile email",
            state: searchParams.get("state") || "",
            nonce: searchParams.get("nonce") || "",
            embed: searchParams.get("embed") === "1",
            codeChallenge: codeChallenge || undefined,
            codeChallengeMethod: (codeChallengeMethod === "S256" || codeChallengeMethod === "plain") ? codeChallengeMethod : undefined,
        };

    });

    let appInfo = $state<{
        name: string;
        description?: string;
        iconUrl?: string;
        websiteUrl?: string;
        supportsE2ee: boolean;
    } | null>(null);
    
    let existingAuth = $state<{
        id: string;
        identityId: string;
        encryptedAppKey?: string;
        createdAt: string;
    } | null>(null);
    
    let selectedIdentity = $state<Identity | null>(null);
    let identityDropdownOpen = $state(false);
    let loading = $state(true);
    let authorizing = $state(false);
    let error = $state<string | null>(null);
    let sliderPosition = $state(0);
    let sliderActive = $state(false);
    let needsMasterKey = $state(false);

    // Load app info
    async function loadAppInfo() {
        if (!params.clientId) {
            error = "Missing client_id parameter";
            loading = false;
            return;
        }

        try {
            loading = true;
            
            // Load app info and check for existing authorization in parallel
            const [appData, authData] = await Promise.all([
                api.oauth.getApp(params.clientId),
                api.oauth.getAuthorization(params.clientId),
            ]);
            
            appInfo = appData.app;
            existingAuth = authData.authorization;
            
            // Check if this is an E2EE app and we don't have the master key
            if (appData.app.supportsE2ee && !hasMasterKey()) {
                needsMasterKey = true;
            }
            
            // Set default selected identity
            const authState = get(auth);
            
            // If there's an existing auth, try to use that identity
            if (existingAuth) {
                const existingIdentity = authState.identities.find(i => i.id === existingAuth!.identityId);
                selectedIdentity = existingIdentity || authState.currentIdentity || authState.identities[0] || null;
            } else {
                selectedIdentity = authState.currentIdentity || authState.identities[0] || null;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : "Failed to load app info";
        } finally {
            loading = false;
        }
    }

    async function handleAuthorize() {
        if (!selectedIdentity || !appInfo) return;

        try {
            authorizing = true;
            error = null;
            
            const authData: any = {
                clientId: params.clientId,
                redirectUri: params.redirectUri,
                scope: params.scope,
                state: params.state,
                identityId: selectedIdentity.id,
                nonce: params.nonce || undefined,
            };
            
            // Only include PKCE params if they exist
            if (params.codeChallenge) {
                authData.codeChallenge = params.codeChallenge;
            }
            if (params.codeChallengeMethod) {
                authData.codeChallengeMethod = params.codeChallengeMethod;
            }
            
            // For E2EE apps, handle app-specific encryption key
            let rawAppKey: string | null = null;
            
            if (appInfo.supportsE2ee) {
                const masterKey = await loadMasterKey();
                if (!masterKey) {
                    needsMasterKey = true;
                    authorizing = false;
                    sliderPosition = 0;
                    return;
                }
                
                // Check if we have an existing authorization with an encrypted app key
                // AND it's for the same identity we're authorizing with
                const hasExistingKeyForIdentity = existingAuth?.encryptedAppKey && 
                    existingAuth.identityId === selectedIdentity.id;
                
                if (hasExistingKeyForIdentity && existingAuth) {
                    // Decrypt the existing app key
                    const appKey = await decryptAppKey(existingAuth.encryptedAppKey!, masterKey);
                    rawAppKey = await exportAppKey(appKey);
                } else {
                    // Generate a new app key for first-time authorization or new identity
                    const appKey = await generateAppKey();
                    
                    // Encrypt it with the user's master key
                    const encryptedAppKey = await encryptAppKey(appKey, masterKey);
                    authData.encryptedAppKey = encryptedAppKey;
                    
                    // Export the raw app key to pass to the app
                    rawAppKey = await exportAppKey(appKey);
                }
            }
            
            const result = await api.oauth.authorize(authData);
            
            // For E2EE apps, append the app key as a URL fragment (not sent to server)
            let redirectUrl = result.redirectUrl;
            if (appInfo.supportsE2ee && rawAppKey) {
                // Add app key as hash fragment so it's not logged by servers
                const url = new URL(redirectUrl);
                url.hash = `app_key=${rawAppKey}`;
                redirectUrl = url.toString();
            }
            
            // Redirect back to the app
            if (params.embed) {
                window.parent?.postMessage({ type: "ave:success", payload: { redirectUrl } }, window.location.origin);
                return;
            }
            window.location.href = redirectUrl;

        } catch (err) {
            error = err instanceof Error ? err.message : "Authorization failed";
            authorizing = false;
            sliderPosition = 0;
        }
    }

    let sliderPointerId: number | null = null;
    let sliderTarget: HTMLElement | null = null;

    function handleSliderStart(e: PointerEvent) {
        if (authorizing) return;
        sliderActive = true;
        sliderPointerId = e.pointerId;
        sliderTarget = e.currentTarget as HTMLElement | null;
        
        // Set pointer capture for better tracking across browsers
        if (sliderTarget) {
            try {
                sliderTarget.setPointerCapture(e.pointerId);
            } catch (err) {
                // Fallback for browsers that don't support pointer capture
                console.warn("Pointer capture not supported", err);
            }
        }
        
        document.addEventListener("pointermove", handleSliderMove);
        document.addEventListener("pointerup", handleSliderEnd);
        document.addEventListener("pointercancel", handleSliderEnd);
    }

    function handleSliderMove(e: PointerEvent) {
        if (!sliderActive || sliderPointerId !== e.pointerId) return;
        
        e.preventDefault(); // Prevent default drag behavior in Firefox
        
        const slider = document.getElementById("auth-slider");
        if (!slider) return;
        
        const rect = slider.getBoundingClientRect();
        const buttonWidth = window.innerWidth < 768 ? 44 : 70;
        const position = Math.max(0, Math.min(1, (e.clientX - rect.left - buttonWidth / 2) / (rect.width - buttonWidth)));
        sliderPosition = position;
        
        // Auto-authorize when fully slid
        if (position >= 0.95) {
            sliderActive = false;
            handleAuthorize();
        }
    }

    function handleSliderEnd(e: PointerEvent) {
        if (!sliderActive || sliderPointerId !== e.pointerId) return;
        sliderActive = false;
        
        // Release pointer capture - critical for Firefox
        if (sliderTarget && sliderPointerId !== null) {
            try {
                sliderTarget.releasePointerCapture(sliderPointerId);
            } catch (err) {
                // Ignore errors if pointer capture wasn't set
            }
        }
        
        sliderPointerId = null;
        sliderTarget = null;
        document.removeEventListener("pointermove", handleSliderMove);
        document.removeEventListener("pointerup", handleSliderEnd);
        document.removeEventListener("pointercancel", handleSliderEnd);
        
        // Snap back if not authorized
        if (sliderPosition < 0.95) {
            sliderPosition = 0;
        }
    }


    function handleDeny() {
        // Redirect back with error
        const redirectUrl = new URL(params.redirectUri);
        redirectUrl.searchParams.set("error", "access_denied");
        if (params.state) {
            redirectUrl.searchParams.set("state", params.state);
        }
        if (params.embed) {
            window.parent?.postMessage({ type: "ave:error", payload: { error: "access_denied" } }, window.location.origin);
            return;
        }
        window.location.href = redirectUrl.toString();

    }

    // Check auth and load app info
    $effect(() => {
        if (!$isAuthenticated) {
            // Redirect to login, then come back
            const returnUrl = encodeURIComponent(window.location.pathname) + window.location.search;
            if (params.embed) {
                window.parent?.postMessage({ type: "ave:auth_required" }, window.location.origin);
            }
            goto(`/login?return=${returnUrl}`);
            return;
        }

        loadAppInfo();
    });
</script>

<div class="bg-[#090909] min-h-screen-fixed flex flex-col md:flex-row md:items-stretch items-center gap-6 md:gap-[50px] p-6 md:p-[50px] relative overflow-auto">
    <div class="flex-1 z-10 flex flex-col items-start justify-start md:justify-between p-4 md:p-[50px] w-full">
        <div class="flex flex-row gap-4 md:gap-[20px] items-start">
            {#if appInfo?.iconUrl}
                <img src={appInfo.iconUrl} alt="{appInfo.name} Logo" class="w-12 h-12 md:w-[80px] md:h-[80px]"/>
            {:else}
                <div class="w-12 h-12 md:w-[80px] md:h-[80px] bg-[#171717] rounded-[12px] md:rounded-[16px] flex items-center justify-center">
                    <Text type="h" size={32} color="#878787">{appInfo?.name?.[0] || "?"}</Text>
                </div>
            {/if}
            <div class="flex flex-col gap-1 md:gap-[10px]">
                <h1 class="font-poppins text-2xl md:text-[48px] text-white">
                    {appInfo?.name || "Loading..."}
                </h1>
                {#if appInfo?.websiteUrl}
                    <a href={appInfo.websiteUrl} target="_blank" rel="noopener noreferrer" class="font-poppins text-base md:text-[24px] text-[#878787] hover:text-[#FFFFFF] transition-colors">
                        {new URL(appInfo.websiteUrl).hostname}
                    </a>
                {/if}
            </div>
        </div>

        <div class="flex flex-col gap-3 md:gap-[20px] mt-6 md:mt-0">
            <h2 class="font-poppins text-base md:text-[32px] text-[#878787]">
                You're signing in securely through Ave.
            </h2>

            {#if appInfo?.description}
                <p class="font-poppins text-xs md:text-[20px] text-[#666666]">
                    {appInfo.description}
                </p>
            {/if}

            {#if appInfo?.supportsE2ee}
                <div class="flex flex-col gap-2 md:gap-[10px]">
                    <div class="p-4 md:p-[30px] bg-[#171717]/80 flex flex-col gap-2 md:gap-[10px] border-2 border-[#32A94C] rounded-[20px] md:rounded-[32px]">
                        <h3 class="font-poppins flex flex-row gap-2 md:gap-[10px] text-sm md:text-[24px] text-[#32A94C] items-center">
                            <svg class="w-5 h-5 md:w-9 md:h-9" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10.5 15V10.5C10.5 8.51088 11.2902 6.60322 12.6967 5.1967C14.1032 3.79018 16.0109 3 18 3C19.9891 3 21.8968 3.79018 23.3033 5.1967C24.7098 6.60322 25.5 8.51088 25.5 10.5V15M19.5 24C19.5 24.8284 18.8284 25.5 18 25.5C17.1716 25.5 16.5 24.8284 16.5 24C16.5 23.1716 17.1716 22.5 18 22.5C18.8284 22.5 19.5 23.1716 19.5 24ZM7.5 15H28.5C30.1569 15 31.5 16.3431 31.5 18V30C31.5 31.6569 30.1569 33 28.5 33H7.5C5.84315 33 4.5 31.6569 4.5 30V18C4.5 16.3431 5.84315 15 7.5 15Z" stroke="#32A94C" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            End-to-End Encrypted
                        </h3>
                        <p class="font-poppins text-xs md:text-[22px] text-[#878787]">
                            This app requests encryption keys from Ave each time you log in, ensuring your data stays end-to-end encrypted.
                        </p>
                    </div>
                </div>
            {/if}
        </div>

    </div>

    <div class="flex-1 w-full md:min-h-full px-4 md:px-[75px] z-10 py-5 md:py-[70px] flex flex-col justify-between rounded-[24px] md:rounded-[64px] bg-[#111111]/60 backdrop-blur-xl">
        {#if loading}
            <div class="flex-1 flex items-center justify-center">
                <div class="w-[48px] h-[48px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
            </div>
        {:else if needsMasterKey}
            <div class="flex flex-col gap-[30px] items-center justify-center flex-1">
                <div class="w-[80px] h-[80px] rounded-full bg-[#E14747]/20 flex items-center justify-center">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 8V12M12 16H12.01" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="text-center">
                    <Text type="h" size={24} color="#FFFFFF">Encryption Key Required</Text>
                    <p class="text-[#878787] text-[16px] mt-[10px] max-w-[400px]">
                        This app uses end-to-end encryption. Your encryption key wasn't found on this device.
                    </p>
                </div>
                <div class="flex flex-col gap-[15px] w-full max-w-[350px]">
                    <button 
                        class="w-full py-[18px] bg-[#FFFFFF] text-[#090909] font-semibold rounded-[16px] hover:bg-[#E0E0E0] transition-colors"
                        onclick={() => goto("/login?return=" + encodeURIComponent(window.location.pathname) + window.location.search)}
                    >
                        Sign In with Trust Code
                    </button>
                    <p class="text-[#666666] text-[14px] text-center">
                        Use your trust code to restore your encryption key on this device.
                    </p>
                </div>
            </div>
        {:else if error}
            <div class="flex flex-col gap-[20px] items-center justify-center flex-1">
                <Text type="h" size={24} color="#E14747">{error}</Text>
                <button 
                    class="px-[30px] py-[15px] bg-[#171717] hover:bg-[#222222] rounded-full text-[#FFFFFF] transition-colors"
                    onclick={() => history.back()}
                >
                    Go Back
                </button>
            </div>
        {:else if selectedIdentity}
            <div class="flex flex-col gap-4 md:gap-[40px]">
                <div class="flex flex-col md:flex-row gap-3 md:gap-[20px] items-start md:items-center">
                <h1 class="text-white text-xl md:text-[48px] font-bold font-poppins">Sign in as</h1>


                    <!-- Identity dropdown -->
                    <div class="relative w-full md:w-auto">
                        <button 
                            class="bg-[#171717] p-1.5 md:p-[10px] items-center rounded-full flex flex-row gap-2 md:gap-[15px] hover:bg-[#242424] cursor-pointer transition-colors duration-300"
                            onclick={() => { identityDropdownOpen = !identityDropdownOpen; }}
                        >
                            {#if selectedIdentity.avatarUrl}
                                <img src={selectedIdentity.avatarUrl} alt="User Avatar" class="w-8 h-8 md:w-[50px] md:h-[50px] rounded-full object-cover"/>
                            {:else}
                                <div class="w-8 h-8 md:w-[50px] md:h-[50px] rounded-full bg-[#222222] flex items-center justify-center">
                                    <Text type="h" size={20} mobileSize={14} color="#878787">{selectedIdentity.displayName[0]}</Text>
                                </div>
                            {/if}
                            <span class="text-white text-base md:text-[24px] font-poppins font-semibold">
                                {selectedIdentity.displayName}
                            </span>
                            <svg class="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 9L12 15L18 9" stroke="#C7C7C7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        
                        {#if identityDropdownOpen && $identitiesStore.length > 1}
                            <div class="absolute top-full left-0 mt-2 md:mt-[10px] bg-[#171717] rounded-[16px] overflow-hidden z-50 min-w-full">
                                {#each $identitiesStore as identity}
                                    <button 
                                        class="w-full flex flex-row gap-2 md:gap-[15px] items-center p-3 md:p-[15px] hover:bg-[#222222] transition-colors {identity.id === selectedIdentity.id ? 'bg-[#222222]' : ''}"
                                        onclick={() => { selectedIdentity = identity; identityDropdownOpen = false; }}
                                    >
                                        {#if identity.avatarUrl}
                                            <img src={identity.avatarUrl} alt="" class="w-8 h-8 md:w-[40px] md:h-[40px] rounded-full object-cover"/>
                                        {:else}
                                            <div class="w-8 h-8 md:w-[40px] md:h-[40px] rounded-full bg-[#333333] flex items-center justify-center">
                                                <Text type="h" size={16} color="#878787">{identity.displayName[0]}</Text>
                                            </div>
                                        {/if}
                                        <span class="text-white text-base md:text-[18px] font-poppins">{identity.displayName}</span>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>

                <IdentityCard 
                    avatar={selectedIdentity.avatarUrl || "/placeholder.png"} 
                    banner={selectedIdentity.bannerUrl?.startsWith("#") ? undefined : selectedIdentity.bannerUrl || undefined} 
                    bannerColor={selectedIdentity.bannerUrl?.startsWith("#") ? selectedIdentity.bannerUrl : "#B9BBBE"} 
                    editable={false}
                >
                    <div class="flex flex-col gap-2 md:gap-[10px]">
                        <div class="flex flex-col md:flex-row gap-2 md:gap-[10px] w-full flex-1">
                            <div class="p-3 md:p-[30px] bg-[#111111] rounded-[20px] md:rounded-[32px] flex-1">
                                <Text type="hd" size={16} mobileSize={12} color="#878787">NAME</Text>
                                <Text type="h" size={26} mobileSize={18} color="#FFFFFF">{selectedIdentity.displayName}</Text>
                            </div>
                            <div class="p-3 md:p-[30px] bg-[#111111] rounded-[20px] md:rounded-[32px] flex-1">
                                <Text type="hd" size={16} mobileSize={12} color="#878787">HANDLE</Text>
                                <Text type="h" size={26} mobileSize={18} color="#FFFFFF">{selectedIdentity.handle}</Text>
                            </div>
                        </div>
                        {#if selectedIdentity.email}
                            <div class="p-3 md:p-[30px] bg-[#111111] rounded-[20px] md:rounded-[32px]">
                                <Text type="hd" size={16} mobileSize={12} color="#878787">EMAIL</Text>
                                <Text type="h" size={26} mobileSize={18} color="#FFFFFF">{selectedIdentity.email}</Text>
                            </div>
                        {/if}
                    </div>
                </IdentityCard>
            </div>

            <!-- Swipe to sign in -->
            <div class="flex flex-col gap-3 md:gap-[20px] mt-4 md:mt-0">
                <div 
                    id="auth-slider"
                    class="rounded-full bg-[#171717]/80 border-[3px] md:border-[6px] border-[#171717]/80 w-full relative h-[50px] md:h-[82px]"
                >
                    <button 
                        class="w-[44px] h-[44px] md:w-[70px] md:h-[70px] bg-white rounded-full cursor-grab flex items-center justify-center absolute top-0 z-10 transition-transform {sliderActive ? '' : 'transition-all duration-300'}"
                        style="left: calc({sliderPosition * 100}% * (1 - 44px / 100%)); --mobile-btn: 44px; --desktop-btn: 70px;"
                        onpointerdown={handleSliderStart}
                        disabled={authorizing}
                        aria-label="Drag to sign in"
                    >
                        {#if authorizing}
                            <div class="w-5 h-5 md:w-[24px] md:h-[24px] border-2 border-[#090909] border-t-transparent rounded-full animate-spin"></div>
                        {:else}
                            <svg class="w-5 h-5 md:w-[35px] md:h-[35px]" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11 30L23 18L11 6" stroke="#090909" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        {/if}
                    </button>

                    <p class="text-[#878787] text-sm md:text-[18px] font-poppins font-normal absolute top-0 bottom-0 left-0 right-0 text-center flex items-center justify-center pointer-events-none">
                        {authorizing ? "Signing in..." : "Swipe to Sign In"}
                    </p>

                </div>

                <button 
                    class="text-[#878787] text-xs md:text-[16px] hover:text-[#E14747] transition-colors"
                    onclick={handleDeny}
                    disabled={authorizing}
                >
                    Deny Access
                </button>
            </div>
        {/if}
    </div>

    <div class="absolute bottom-0 right-0 pointer-events-none hidden md:block">
        <svg width="1416" height="695" viewBox="0 0 1416 695" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g filter="url(#filter0_f_3071_668)">
            <path d="M910.219 401.152C913.621 399.616 917.519 399.616 920.921 401.152L1423.47 628.138C1436.23 633.9 1432.12 652.985 1418.12 652.985H413.018C399.02 652.985 394.91 633.9 407.667 628.138L910.219 401.152Z" fill="#B9BBBE"/>
            </g>
            <defs>
            <filter id="filter0_f_3071_668" x="0" y="0" width="1831.14" height="1052.99" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
            <feGaussianBlur stdDeviation="200" result="effect1_foregroundBlur_3071_668"/>
            </filter>
            </defs>
        </svg>
    </div>
</div>
