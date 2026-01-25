<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import Button from "../../../components/Button.svelte";
    import IdentityCard from "../../../components/IdentityCard.svelte";
    import { api } from "../../../lib/api";

    interface IdentityData {
        displayName: string;
        handle: string;
        email: string;
        birthday: string;
        avatarUrl: string;
        bannerUrl: string;
        bannerColor: string;
    }

    let { onNext, initialData } = $props<{ 
        onNext?: (data: IdentityData) => void;
        initialData?: IdentityData;
    }>();

    let displayName = $state(initialData?.displayName || "");
    let handle = $state(initialData?.handle || "");
    let email = $state(initialData?.email || "");
    let birthday = $state(initialData?.birthday || "");
    let avatarUrl = $state(initialData?.avatarUrl || "");
    let bannerUrl = $state(initialData?.bannerUrl || "");
    let bannerColor = $state(initialData?.bannerColor || "#1a1a2e");

    let handleError = $state("");
    let isCheckingHandle = $state(false);
    let isLoading = $state(false);

    // Debounced handle check
    let handleCheckTimeout: number | null = null;

    function onHandleChange(e: Event) {
        const input = e.target as HTMLInputElement;
        handle = input.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
        handleError = "";
        
        if (handleCheckTimeout) {
            clearTimeout(handleCheckTimeout);
        }
        
        if (handle.length >= 3) {
            isCheckingHandle = true;
            handleCheckTimeout = window.setTimeout(async () => {
                try {
                    const { available, reason } = await api.register.checkHandle(handle);
                    if (!available) {
                        handleError = reason || "Handle is already taken";
                    }
                } catch {
                    // Ignore errors during typing
                }
                isCheckingHandle = false;
            }, 500);
        }
    }

    function validate(): boolean {
        if (!displayName.trim()) {
            return false;
        }
        if (handle.length < 3) {
            handleError = "Handle must be at least 3 characters";
            return false;
        }
        if (handleError) {
            return false;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return false;
        }
        return true;
    }

    async function goNext() {
        if (!validate()) return;
        
        isLoading = true;
        onNext?.({
            displayName: displayName.trim(),
            handle,
            email: email.trim(),
            birthday,
            avatarUrl,
            bannerUrl,
            bannerColor,
        });
    }

    function handleAvatarUpload(file: File) {
        // In production, upload to server and get URL
        // For now, create a local object URL
        avatarUrl = URL.createObjectURL(file);
    }

    function handleBannerChange(fileOrHex: File | string) {
        if (typeof fileOrHex === "string") {
            bannerColor = fileOrHex;
            bannerUrl = "";
        } else {
            bannerUrl = URL.createObjectURL(fileOrHex);
        }
    }

    let isValid = $derived(
        displayName.trim().length > 0 && 
        handle.length >= 3 && 
        !handleError &&
        (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    );
</script>

<div class="w-full min-h-screen-fixed flex flex-col items-center justify-center px-6 md:px-[150px] py-12 md:py-[150px] gap-8 md:gap-[150px] overflow-auto scroll-smooth">
   <div class="flex flex-col items-center justify-center gap-4 md:gap-[10px] w-full md:w-[50%] z-10">
       <Text type={"hd"} size={36} cclass="self-center text-2xl md:text-[36px]">
           WHO ARE YOU?
       </Text>

        <IdentityCard 
            avatar={avatarUrl || "/placeholder.png"} 
            banner={bannerUrl} 
            bannerColor={bannerColor} 
            onUploadAvatar={handleAvatarUpload} 
            onChangeBanner={handleBannerChange}
        >
            <div class="flex flex-col gap-2 md:gap-[10px]">
                <div class="p-5 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">NAME *</Text>
                    <input 
                        type="text" 
                        class="w-full bg-transparent border-b border-[#333333] mt-2 md:mt-[10px] pb-[5px] text-white placeholder:text-[#555] focus:outline-none text-base md:text-inherit" 
                        placeholder="Enter your name"
                        bind:value={displayName}
                        maxlength={64}
                    />
                </div>
                <div class="p-5 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px]">
                    <div class="flex items-center justify-between">
                        <Text type="hd" size={16} color="#878787">HANDLE *</Text>
                        {#if isCheckingHandle}
                            <div class="w-4 h-4 border-2 border-transparent border-t-white rounded-full animate-spin"></div>
                        {:else if handle.length >= 3 && !handleError}
                            <span class="text-white text-sm">Available</span>
                        {/if}
                    </div>
                    <input 
                        type="text" 
                        class="w-full bg-transparent border-b mt-2 md:mt-[10px] pb-[5px] text-white placeholder:text-[#555] focus:outline-none text-base md:text-inherit {handleError ? 'border-red-500' : 'border-[#333333]'}" 
                        placeholder="Enter your handle"
                        value={handle}
                        oninput={onHandleChange}
                        maxlength={32}
                    />
                    {#if handleError}
                        <p class="text-red-500 text-sm mt-1">{handleError}</p>
                    {:else}
                        <p class="text-[#555] text-xs md:text-sm mt-1">Letters, numbers, and underscores only</p>
                    {/if}
                </div>
                <div class="p-5 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">EMAIL</Text>
                    <input 
                        type="email" 
                        class="w-full bg-transparent border-b border-[#333333] mt-2 md:mt-[10px] pb-[5px] text-white placeholder:text-[#555] focus:outline-none text-base md:text-inherit" 
                        placeholder="Enter your email (optional)"
                        bind:value={email}
                    />
                </div>
                <div class="p-5 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">BIRTHDAY</Text>
                    <input 
                        type="date" 
                        class="w-full bg-transparent border-b border-[#333333] mt-2 md:mt-[10px] pb-[5px] text-white placeholder:text-[#555] focus:outline-none text-base md:text-inherit"
                        bind:value={birthday}
                    />
                </div>
            </div>
        </IdentityCard>

       <Button 
           text={isLoading ? "CHECKING..." : "CONTINUE"} 
           onclick={() => goNext()} 
           icon="/icons/chevronbk-right-38.svg"
           disabled={!isValid || isLoading}
       />
   </div>
</div>
