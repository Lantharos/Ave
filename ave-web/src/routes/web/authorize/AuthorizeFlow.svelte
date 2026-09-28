<script lang="ts">
import { hasE2eeResetScope, resolveRequestedE2eeMode } from "$lib/surfaces/web/lib/oauth/e2ee-scopes";
import { isAuthenticated, identities as identitiesStore } from "$lib/surfaces/web/stores/auth";
import AuthSlider from "./components/AuthSlider.svelte";
import MasterKeyRecovery from "./components/MasterKeyRecovery.svelte";
import IdentityCard from "$lib/surfaces/web/components/IdentityCard.svelte";
import Text from "$lib/surfaces/web/components/Text.svelte";
import StorageAccessGate from "$lib/surfaces/web/components/StorageAccessGate.svelte";
import { createAuthorizationFlow } from "./authorization-flow.svelte";
const flow = createAuthorizationFlow();
</script>

{#if flow.embedSheet && !$isAuthenticated && !flow.resolvedAppInfo && !flow.appInfo}
    <div class="bg-[#090909] min-h-screen-fixed flex items-center justify-center p-6 md:p-[50px]">
        <div class="w-[48px] h-[48px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
    </div>
{:else if flow.embeddedSession.needsStorageAccess}
    <StorageAccessGate
        title={`Sign in to continue to ${flow.appDisplayName()}`}
        message={flow.embeddedSession.storageAccessError || `We'll open a secure browser page so you can finish sign-in for ${flow.appDisplayName()} and come right back.`}
        cta="Continue in browser"
        busy={flow.embeddedSession.requestingStorageAccess}
        iconUrl={flow.appInfo?.iconUrl || null}
        onclick={flow.embeddedSession.handleStorageAccessContinue}
    />
    {:else if flow.autoAuthorizing}
	    <div class="bg-[#090909] min-h-screen-fixed flex items-center justify-center p-6 md:p-[50px]">
	        <div class="flex flex-col items-center text-center gap-4">
				{#if flow.launchedExternalApp}
					<div class="w-[52px] h-[52px] border-2 border-[#FFFFFF] rounded-full flex items-center justify-center">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M20 7L9 18L4 13" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</div>
				{:else}
	            	<div class="w-[52px] h-[52px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
				{/if}
	            <div>
	                <Text type="h" size={22} color="#FFFFFF">{flow.launchedExternalApp ? "Opened your app" : "Signing you in"}</Text>
	                <p class="text-[#7B7B7B] text-[15px] mt-[6px]">{flow.launchedExternalApp ? "You can continue there now." : "Finishing securely…"}</p>
	            </div>
	        </div>
	    </div>
	{:else if flow.loading || flow.completed}
	    <div class="bg-[#090909] min-h-screen-fixed flex items-center justify-center p-6 md:p-[50px]">
			{#if flow.completed && flow.launchedExternalApp}
				<div class="flex flex-col items-center text-center gap-4">
					<div class="w-[52px] h-[52px] border-2 border-[#FFFFFF] rounded-full flex items-center justify-center">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M20 7L9 18L4 13" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
						</svg>
					</div>
					<div>
						<Text type="h" size={22} color="#FFFFFF">Opened your app</Text>
						<p class="text-[#7B7B7B] text-[15px] mt-[6px]">You can continue there now.</p>
					</div>
				</div>
			{:else}
	        	<div class="w-[48px] h-[48px] border-2 border-[#FFFFFF] border-t-transparent rounded-full animate-spin"></div>
			{/if}
	    </div>
	{:else}
<div class="authorize-shell bg-[#090909] min-h-screen-fixed flex flex-col md:flex-row md:items-stretch items-center gap-6 md:gap-[50px] p-6 md:p-[50px] relative overflow-auto hide-scrollbar">
    <div class="flex-1 z-10 flex flex-col items-start justify-start md:justify-between p-4 md:p-[50px] w-full max-w-[760px] md:max-w-none mx-auto md:mx-0">
        <div class="flex flex-row gap-4 md:gap-[20px] items-start">
            <!-- App icon that becomes back button on hover -->
            <button
                class="group relative w-12 h-12 md:w-[80px] md:h-[80px] overflow-hidden cursor-pointer transition-transform hover:scale-105"
                onclick={flow.handleDeny}
                disabled={flow.authorizing}
                title="Go back"
            >
                {#if flow.appInfo?.iconUrl}
                    <img src={flow.appInfo.iconUrl} alt="{flow.appInfo.name} Logo" class="w-full h-full object-cover transition-opacity group-hover:opacity-0"/>
                {:else}
                    <div class="w-full h-full bg-[#171717] flex items-center justify-center transition-opacity group-hover:opacity-0">
                        <Text type="h" size={32} color="#878787">{flow.appInfo?.name?.[0] || "?"}</Text>
                    </div>
                {/if}
                <!-- Back arrow overlay on hover -->
                <div class="absolute inset-0 bg-[#171717] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg class="w-6 h-6 md:w-[36px] md:h-[36px]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="#878787" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            </button>
            <div class="flex flex-col gap-1 md:gap-[10px]">
                <h1 class="font-poppins text-2xl md:text-[48px] text-white">
                    {flow.appInfo?.name || "Loading..."}
                </h1>
                {#if flow.appInfo?.websiteUrl}
                    <a href={flow.appInfo.websiteUrl} target="_blank" rel="noopener noreferrer" class="font-poppins text-base md:text-[24px] text-[#878787] hover:text-[#FFFFFF] transition-colors">
                        {new URL(flow.appInfo.websiteUrl).hostname}
                    </a>
                {/if}
            </div>
        </div>

        <div class="flex flex-col gap-3 md:gap-[20px] mt-6 md:mt-0">
            <h2 class="font-poppins text-base md:text-[32px] text-[#878787]">
                Create your account or sign in securely.
            </h2>

            {#if flow.appInfo?.description}
                <p class="font-poppins text-xs md:text-[20px] text-[#666666]">
                    {flow.appInfo.description} Secure sign-in is powered by Ave.
                </p>
            {/if}

            {#if flow.appInfo && flow.authorizeShowsE2ee}
                {@const activeE2eeMode = resolveRequestedE2eeMode(flow.authorizeRequestedScopes, flow.existingAuth)}
                {@const wantsE2eeReset = hasE2eeResetScope(flow.authorizeRequestedScopes)}
                <div class="p-4 md:p-[30px] bg-[#0d1f12]/60 flex flex-col gap-2 md:gap-[10px] border border-[#32A94C]/20 rounded-[20px] md:rounded-[32px]">
                    <h3 class="font-poppins flex flex-row gap-2 md:gap-[10px] text-sm md:text-[20px] text-[#32A94C] items-center">
                        <svg class="w-4 h-4 md:w-6 md:h-6 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 10V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V10M13 16C13 16.5523 12.5523 17 12 17C11.4477 17 11 16.5523 11 16C11 15.4477 11.4477 15 12 15C12.5523 15 13 15.4477 13 16ZM5 10H19C20.1046 10 21 10.8954 21 12V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V12C3 10.8954 3.89543 10 5 10Z" stroke="#32A94C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        End-to-End Encrypted
                    </h3>
                    <p class="font-poppins text-xs md:text-[18px] text-[#666666]">
                        {#if wantsE2eeReset && activeE2eeMode}
                            This app asked to rotate your encryption keys. Your previous keys for this app will be replaced, and encrypted data may be lost if the app did not keep a backup.
                        {:else if activeE2eeMode}
                            This app will receive encryption keys so it can protect your data end-to-end.
                        {:else}
                            This app supports end-to-end encryption.
                        {/if}
                    </p>
                </div>
            {/if}

            {#if flow.wantsUserIdScope}
                <div class="p-4 md:p-[30px] bg-[#2a1f0d]/60 flex flex-col gap-2 md:gap-[10px] border border-[#E8A43A]/25 rounded-[20px] md:rounded-[32px]">
                    <h3 class="font-poppins flex flex-row gap-2 md:gap-[10px] text-sm md:text-[20px] text-[#E8A43A] items-center">
                        <svg class="w-4 h-4 md:w-6 md:h-6 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64537 18.3024 1.55299 18.6453 1.55201 18.9945C1.55103 19.3437 1.64151 19.6871 1.81445 19.9905C1.98738 20.2939 2.23675 20.5467 2.53773 20.7239C2.83871 20.901 3.18082 20.9962 3.53 21H20.47C20.8192 20.9962 21.1613 20.901 21.4623 20.7239C21.7633 20.5467 22.0126 20.2939 22.1856 19.9905C22.3585 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5317 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3438 2.89725 12 2.89725C11.6562 2.89725 11.3183 2.98585 11.0188 3.15448C10.7193 3.32312 10.4683 3.56611 10.29 3.86Z" stroke="#E8A43A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        Account identifier requested
                    </h3>
                    <p class="font-poppins text-xs md:text-[18px] text-[#666666]">
                        This app asked for your account ID, which stays the same across all your identities. Most apps only need your profile identity. Only continue if you trust this app to recognize you across identities.
                    </p>
                </div>
            {/if}
        </div>

    </div>

    <div class="flex-1 w-full max-w-[760px] md:max-w-none mx-auto md:mx-0 md:min-h-full px-4 md:px-[56px] z-10 py-5 md:py-[48px] flex flex-col justify-between rounded-[24px] md:rounded-[52px] bg-[#111111]/60 backdrop-blur-xl">
        {#if flow.masterKeyRecovery.needsMasterKey}
            <MasterKeyRecovery
                bind:view={flow.masterKeyRecovery.masterKeyUnlockView}
                loginRequestId={flow.masterKeyRecovery.masterKeyLoginRequestId}
                loginRequestToken={flow.masterKeyRecovery.masterKeyLoginRequestToken}
                ephemeralKeyPair={flow.masterKeyRecovery.masterKeyEphemeralKeyPair}
                bind:error={flow.masterKeyRecovery.masterKeyError}
                bind:recoveryCode={flow.masterKeyRecovery.recoveryCode}
                recovering={flow.masterKeyRecovery.recoveringMasterKey}
                mismatch={flow.masterKeyRecovery.masterKeyMismatch}
                unlocking={flow.masterKeyRecovery.unlockingMasterKey}
                hasTrustedDevices={flow.masterKeyRecovery.hasTrustedDevices}
                requestingDeviceApproval={flow.masterKeyRecovery.requestingDeviceApproval}
                onRecovered={flow.masterKeyRecovery.handleMasterKeyRecovered}
                onUnlock={flow.masterKeyRecovery.handleUnlockMasterKey}
                onDeviceApproval={flow.masterKeyRecovery.handleMasterKeyDeviceApproval}
                onRecoverySubmit={flow.masterKeyRecovery.handleRecoveryCodeSubmit}
            />
        {:else if flow.error}
            <div class="flex flex-col gap-[20px] items-center justify-center flex-1">
                <Text type="h" size={24} color="#E14747">{flow.error}</Text>
                <button
                    class="px-[30px] py-[15px] bg-[#171717] hover:bg-[#222222] rounded-full text-[#FFFFFF] transition-colors"
                    onclick={() => history.back()}
                >
                    Go Back
                </button>
            </div>
        {:else if flow.selectedIdentity}
            <div class="flex flex-col gap-4 md:gap-[28px]">
                <div class="flex flex-col md:flex-row gap-3 md:gap-[20px] items-start md:items-center">
                <h1 class="text-white text-xl md:text-[48px] font-bold font-poppins">Sign in as</h1>


                    <!-- Identity selector -->
                    <div class="relative w-full md:w-auto max-w-full">
                        {#if $identitiesStore.length > 1}
                        <button
                            class="bg-[#171717] p-1.5 md:p-[10px] items-center rounded-full flex flex-row gap-2 md:gap-[15px] hover:bg-[#242424] cursor-pointer transition-colors duration-300 max-w-full"
                            onclick={() => { flow.identityDropdownOpen = !flow.identityDropdownOpen; }}
                        >
                            {#if flow.selectedIdentity.avatarUrl}
                                <img src={flow.selectedIdentity.avatarUrl} alt="User Avatar" class="w-8 h-8 md:w-[50px] md:h-[50px] aspect-square rounded-full object-cover shrink-0"/>
                            {:else}
                                <div class="w-8 h-8 md:w-[50px] md:h-[50px] rounded-full bg-[#222222] flex items-center justify-center shrink-0">
                                    <Text type="h" size={20} mobileSize={14} color="#878787">{flow.selectedIdentity.displayName[0]}</Text>
                                </div>
                            {/if}
                            <span class="text-white text-base md:text-[24px] font-poppins font-semibold whitespace-nowrap truncate min-w-0">
                                {flow.selectedIdentity.displayName}
                            </span>
                            <svg class="w-5 h-5 md:w-6 md:h-6 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 9L12 15L18 9" stroke="#C7C7C7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        {:else}
                        <div class="bg-[#171717] p-1.5 md:p-[10px] pr-4 md:pr-[20px] items-center rounded-full flex flex-row gap-2 md:gap-[15px]">
                            {#if flow.selectedIdentity.avatarUrl}
                                <img src={flow.selectedIdentity.avatarUrl} alt="User Avatar" class="w-8 h-8 md:w-[50px] md:h-[50px] aspect-square rounded-full object-cover shrink-0"/>
                            {:else}
                                <div class="w-8 h-8 md:w-[50px] md:h-[50px] rounded-full bg-[#222222] flex items-center justify-center">
                                    <Text type="h" size={20} mobileSize={14} color="#878787">{flow.selectedIdentity.displayName[0]}</Text>
                                </div>
                            {/if}
                            <span class="text-white text-base md:text-[24px] font-poppins font-semibold">
                                {flow.selectedIdentity.displayName}
                            </span>
                        </div>
                        {/if}

                        {#if flow.identityDropdownOpen && $identitiesStore.length > 1}
                            <div class="absolute top-full left-0 mt-2 md:mt-[10px] bg-[#171717] rounded-[16px] overflow-hidden z-50 w-max min-w-full max-w-[min(100vw-2rem,28rem)]">
                                {#each $identitiesStore as identity (identity.id)}
                                    <button
                                        class="w-full flex flex-row gap-2 md:gap-[15px] items-center p-3 md:p-[15px] hover:bg-[#222222] transition-colors {identity.id === flow.selectedIdentity.id ? 'bg-[#222222]' : ''}"
                                        onclick={() => flow.selectIdentity(identity)}
                                    >
                                        {#if identity.avatarUrl}
                                            <img src={identity.avatarUrl} alt="" class="w-8 h-8 md:w-[40px] md:h-[40px] aspect-square rounded-full object-cover shrink-0"/>
                                        {:else}
                                            <div class="w-8 h-8 md:w-[40px] md:h-[40px] rounded-full bg-[#333333] flex items-center justify-center shrink-0">
                                                <Text type="h" size={16} color="#878787">{identity.displayName[0]}</Text>
                                            </div>
                                        {/if}
                                        <span class="text-white text-base md:text-[18px] font-poppins whitespace-nowrap">{identity.displayName}</span>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>

                <IdentityCard
                    avatar={flow.selectedIdentity.avatarUrl || "/placeholder.png"}
                    editable={false}
                    compact
                >
                    <div class="flex flex-col gap-2 md:gap-[10px]">
                        <div class="flex flex-col md:flex-row gap-2 md:gap-[10px] w-full flex-1">
                            <div class="p-3 md:p-[20px] bg-[#111111] rounded-[20px] md:rounded-[24px] flex-1 min-w-0">
                                <Text type="hd" size={14} mobileSize={12} color="#878787">NAME</Text>
                                <Text type="h" size={22} mobileSize={18} color="#FFFFFF" cclass="truncate">{flow.selectedIdentity.displayName}</Text>
                            </div>
                            <div class="p-3 md:p-[20px] bg-[#111111] rounded-[20px] md:rounded-[24px] flex-1">
                                <Text type="hd" size={14} mobileSize={12} color="#878787">HANDLE</Text>
                                <Text type="h" size={22} mobileSize={18} color="#FFFFFF">{flow.selectedIdentity.handle}</Text>
                            </div>
                        </div>
                        {#if flow.selectedIdentity.email}
                            <div class="p-3 md:p-[20px] bg-[#111111] rounded-[20px] md:rounded-[24px]">
                                <Text type="hd" size={14} mobileSize={12} color="#878787">EMAIL</Text>
                                <Text type="h" size={22} mobileSize={18} color="#FFFFFF">{flow.selectedIdentity.email}</Text>
                            </div>
                        {/if}
                    </div>
                </IdentityCard>
            </div>

            {#if flow.selectedIdentityNeedsEmail}
                <div class="flex flex-col gap-3 md:gap-[18px] mt-4 md:mt-0">
                    <div class="p-4 md:p-[30px] bg-[#111111] rounded-[20px] md:rounded-[32px] flex flex-col gap-3 md:gap-[16px]">
                        <div>
                            <Text type="h" size={22} mobileSize={18} color="#FFFFFF">Email required to continue</Text>
                            <p class="text-[#878787] text-sm md:text-[16px] mt-2 md:mt-[10px]">
                                {flow.appDisplayName()} requested access to your email. Add and verify it here, then continue.
                            </p>
                        </div>

                        {#if flow.selectedIdentity.pendingEmail}
                            <div class="flex flex-col gap-3 md:gap-[14px]">
                                <div class="p-3 md:p-[22px] bg-[#171717] rounded-[18px] md:rounded-[24px]">
                                    <Text type="hd" size={14} mobileSize={12} color="#878787">PENDING EMAIL</Text>
                                    <Text type="h" size={22} mobileSize={16} color="#FFFFFF">{flow.selectedIdentity.pendingEmail}</Text>
                                </div>
                                <div class="flex flex-col gap-3 min-w-0">
                                    <input
                                        type="text"
                                        inputmode="numeric"
                                        maxlength="6"
                                        class="w-full min-w-0 bg-transparent border-b border-[#333333] pb-[10px] text-white text-lg md:text-[24px] focus:outline-none"
                                        bind:value={flow.emailCode}
                                        placeholder="Enter code"
                                        autocomplete="one-time-code"
                                    />
                                    <button
                                        type="button"
                                        class="w-full sm:w-auto sm:self-end shrink-0 px-5 py-3 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full text-[16px] font-medium disabled:opacity-60"
                                        onclick={flow.handleVerifyEmail}
                                        disabled={flow.emailSubmitting || flow.emailCode.trim().length !== 6}
                                    >
                                        {flow.emailSubmitting ? "..." : "Verify"}
                                    </button>
                                </div>
                                <div class="flex flex-row gap-3">
                                    <button
                                        type="button"
                                        class="text-[#878787] hover:text-[#FFFFFF] transition-colors text-[14px] md:text-[16px]"
                                        onclick={flow.handleResendEmailVerification}
                                        disabled={flow.emailSubmitting}
                                    >
                                        Resend code
                                    </button>
                                </div>
                                <div class="flex flex-col gap-3 min-w-0">
                                    <input
                                        type="email"
                                        class="w-full min-w-0 bg-transparent border-b border-[#333333] pb-[10px] text-white text-lg md:text-[24px] focus:outline-none"
                                        bind:value={flow.emailDraft}
                                        placeholder="Use another email"
                                        autocomplete="email"
                                    />
                                    <button
                                        type="button"
                                        class="w-full sm:w-auto sm:self-end shrink-0 px-5 py-3 bg-[#171717] hover:bg-[#202020] text-[#FFFFFF] rounded-full text-[16px] font-medium disabled:opacity-60"
                                        onclick={flow.handleStartEmailVerification}
                                        disabled={flow.emailSubmitting || !flow.emailDraft.trim()}
                                    >
                                        {flow.emailSubmitting ? "..." : "Change"}
                                    </button>
                                </div>
                            </div>
                        {:else}
                            <div class="flex flex-col gap-3 min-w-0">
                                <input
                                    type="email"
                                    class="w-full min-w-0 bg-transparent border-b border-[#333333] pb-[10px] text-white text-lg md:text-[24px] focus:outline-none"
                                    bind:value={flow.emailDraft}
                                    placeholder="Enter email"
                                    autocomplete="email"
                                />
                                <button
                                    type="button"
                                    class="w-full sm:w-auto sm:self-end shrink-0 px-5 py-3 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full text-[16px] font-medium disabled:opacity-60"
                                    onclick={flow.handleStartEmailVerification}
                                    disabled={flow.emailSubmitting || !flow.emailDraft.trim()}
                                >
                                    {flow.emailSubmitting ? "..." : "Send code"}
                                </button>
                            </div>
                        {/if}
                    </div>
                </div>
            {:else}
                <AuthSlider authorizing={flow.authorizing} onauthorize={() => flow.handleAuthorize()} />
            {/if}
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
{/if}
