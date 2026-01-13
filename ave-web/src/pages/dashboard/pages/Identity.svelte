<script lang="ts">
    import Text from "../../../components/Text.svelte";
    import IdentityCard from "../../../components/IdentityCard.svelte";
    import Button from "../../../components/Button.svelte";
    import { api, type Identity as IdentityType } from "../../../lib/api";
    import { auth } from "../../../stores/auth";

    let { newIdentity = false, identity = null } = $props<{
        newIdentity?: boolean;
        identity?: IdentityType | null;
    }>();

    // Form state
    let displayName = $state(identity?.displayName || "");
    let handle = $state(identity?.handle || "");
    let email = $state(identity?.email || "");
    let birthday = $state(identity?.birthday || "");
    let avatarUrl = $state(identity?.avatarUrl || "");
    let bannerUrl = $state(identity?.bannerUrl || "");

    let editing = $state({
        displayName: false,
        handle: false,
        email: false,
        birthday: false
    });

    let isSaving = $state(false);
    let uploadingAvatar = $state(false);
    let uploadingBanner = $state(false);
    let error = $state("");
    let success = $state("");

    // Reset form when identity changes
    $effect(() => {
        if (identity) {
            displayName = identity.displayName;
            handle = identity.handle;
            email = identity.email || "";
            birthday = identity.birthday || "";
            avatarUrl = identity.avatarUrl || "";
            bannerUrl = identity.bannerUrl || "";
        }
    });

    async function saveField(field: string) {
        if (!identity) return;
        
        isSaving = true;
        error = "";
        success = "";

        try {
            const updateData: Record<string, string | null> = {};
            
            switch (field) {
                case "displayName":
                    updateData.displayName = displayName;
                    break;
                case "handle":
                    updateData.handle = handle;
                    break;
                case "email":
                    updateData.email = email || null;
                    break;
                case "birthday":
                    updateData.birthday = birthday || null;
                    break;
            }

            const { identity: updated } = await api.identities.update(identity.id, updateData);
            auth.updateIdentity(updated);
            editing[field as keyof typeof editing] = false;
            success = "Saved!";
            setTimeout(() => success = "", 2000);
        } catch (e: any) {
            error = e.message || "Failed to save";
        } finally {
            isSaving = false;
        }
    }

    async function createIdentity() {
        if (!displayName.trim() || !handle.trim()) {
            error = "Name and handle are required";
            return;
        }

        isSaving = true;
        error = "";

        try {
            const { identity: created } = await api.identities.create({
                displayName: displayName.trim(),
                handle: handle.trim().toLowerCase(),
                email: email.trim() || undefined,
                birthday: birthday || undefined,
                avatarUrl: avatarUrl || undefined,
                bannerUrl: bannerUrl || undefined,
            });

            auth.addIdentity(created);
            success = "Identity created!";
            
            // Reset form
            displayName = "";
            handle = "";
            email = "";
            birthday = "";
            avatarUrl = "";
            bannerUrl = "";
        } catch (e: any) {
            error = e.message || "Failed to create identity";
        } finally {
            isSaving = false;
        }
    }

    function formatBirthday(dateStr: string): string {
        if (!dateStr) return "Not set";
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }

    async function handleAvatarUpload(file: File) {
        if (!identity) {
            // For new identity, just use object URL
            avatarUrl = URL.createObjectURL(file);
            return;
        }

        try {
            uploadingAvatar = true;
            error = "";
            const result = await api.upload.avatar(identity.id, file);
            
            console.log("[Avatar Upload] Got R2 URL:", result.avatarUrl);
            
            // Fetch the updated identity from the API to ensure we have the latest data
            const { identity: updatedIdentity } = await api.identities.get(identity.id);
            console.log("[Avatar Upload] Fetched updated identity:", updatedIdentity.avatarUrl);
            
            // Update auth store with fresh identity data
            auth.updateIdentity(updatedIdentity);
            
            success = "Avatar updated!";
            setTimeout(() => success = "", 2000);
        } catch (e: any) {
            console.error("[Avatar Upload] Failed:", e);
            error = e.message || "Failed to upload avatar";
        } finally {
            uploadingAvatar = false;
        }
    }

    async function handleBannerChange(fileOrHex: File | string) {
        if (!identity) {
            // For new identity, just use object URL or color
            if (typeof fileOrHex === "string") {
                // Store color as bannerUrl (it starts with #)
                bannerUrl = fileOrHex;
            } else {
                bannerUrl = URL.createObjectURL(fileOrHex);
            }
            return;
        }

        if (typeof fileOrHex === "string") {
            // Color selected - save color as bannerUrl
            try {
                uploadingBanner = true;
                error = "";
                // Update identity with color as bannerUrl
                const { identity: updated } = await api.identities.update(identity.id, {
                    bannerUrl: fileOrHex
                });
                bannerUrl = fileOrHex;
                auth.updateIdentity(updated);
                success = "Banner color updated!";
                setTimeout(() => success = "", 2000);
            } catch (e: any) {
                error = e.message || "Failed to update banner";
            } finally {
                uploadingBanner = false;
            }
        } else {
            // File selected - upload banner
            try {
                uploadingBanner = true;
                error = "";
                const result = await api.upload.banner(identity.id, fileOrHex);
                
                console.log("[Banner Upload] Got R2 URL:", result.bannerUrl);
                
                // Fetch the updated identity from the API to ensure we have the latest data
                const { identity: updatedIdentity } = await api.identities.get(identity.id);
                console.log("[Banner Upload] Fetched updated identity:", updatedIdentity.bannerUrl);
                
                // Update auth store with fresh identity data
                auth.updateIdentity(updatedIdentity);
                
                success = "Banner updated!";
                setTimeout(() => success = "", 2000);
            } catch (e: any) {
                console.error("[Banner Upload] Failed:", e);
                error = e.message || "Failed to upload banner";
            } finally {
                uploadingBanner = false;
            }
        }
    }

    // Edit button SVG
    const editIcon = `<svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clip-path="url(#clip0_3396_259)">
            <path d="M26.25 8.75006L33.25 15.7501M37.0545 11.9211C37.9798 10.996 38.4996 9.74137 38.4998 8.43305C38.5 7.12473 37.9804 5.86992 37.0554 4.94468C36.1304 4.01944 34.8757 3.49955 33.5674 3.49939C32.2591 3.49923 31.0043 4.0188 30.079 4.94381L6.72351 28.3046C6.31719 28.7097 6.01671 29.2085 5.84851 29.7571L3.53676 37.3731C3.49153 37.5244 3.48811 37.6852 3.52687 37.8383C3.56563 37.9914 3.64512 38.1312 3.7569 38.2428C3.86868 38.3544 4.00859 38.4337 4.16178 38.4722C4.31498 38.5107 4.47574 38.507 4.62701 38.4616L12.2448 36.1516C12.7928 35.9849 13.2916 35.6862 13.6973 35.2818L37.0545 11.9211Z" stroke="white" stroke-opacity="0.8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
    </svg>`;

    // Helper to check if bannerUrl is a color (starts with #) or an image URL
    let bannerIsColor = $derived(bannerUrl.startsWith("#"));
    let bannerImage = $derived(bannerIsColor ? undefined : bannerUrl || undefined);
    let bannerColorValue = $derived(bannerIsColor ? bannerUrl : "#B9BBBE");

    // Delete identity
    let showDeleteConfirm = $state(false);
    let isDeleting = $state(false);

    async function deleteIdentity() {
        if (!identity) return;
        
        isDeleting = true;
        error = "";

        try {
            await api.identities.delete(identity.id);
            auth.removeIdentity(identity.id);
            showDeleteConfirm = false;
            // The parent component should handle navigation after deletion
        } catch (e: any) {
            error = e.message || "Failed to delete identity";
        } finally {
            isDeleting = false;
        }
    }
</script>

<div class="flex flex-col gap-6 md:gap-[40px] w-full z-10 p-4 md:p-[60px] bg-[#111111]/60 rounded-[32px] md:rounded-[64px] backdrop-blur-[20px]">
    {#if error}
        <div class="bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-2xl">
            {error}
        </div>
    {/if}
    
    {#if success}
        <div class="bg-[#32A94C]/20 border border-[#32A94C] text-[#32A94C] px-4 py-3 rounded-2xl">
            {success}
        </div>
    {/if}

    {#if newIdentity}
        <IdentityCard 
            avatar={avatarUrl || "/placeholder.png"} 
            banner={bannerImage} 
            bannerColor={bannerColorValue} 
            size="large" 
            onUploadAvatar={handleAvatarUpload} 
            onChangeBanner={handleBannerChange}
        >
            <div class="flex flex-col gap-2 md:gap-[10px]">
                <div class="p-4 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">NAME *</Text>
                    <input 
                        type="text" 
                        class="w-full bg-transparent border-b border-[#333333] mt-2 md:mt-[10px] pb-[5px] text-white focus:outline-none" 
                        placeholder="Enter your name"
                        bind:value={displayName}
                        autocomplete="off"
                    />
                </div>
                <div class="p-4 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">HANDLE *</Text>
                    <input 
                        type="text" 
                        class="w-full bg-transparent border-b border-[#333333] mt-2 md:mt-[10px] pb-[5px] text-white focus:outline-none" 
                        placeholder="Enter your handle"
                        bind:value={handle}
                        autocomplete="off"
                    />
                </div>
                <div class="p-4 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">EMAIL</Text>
                    <input 
                        type="email" 
                        class="w-full bg-transparent border-b border-[#333333] mt-2 md:mt-[10px] pb-[5px] text-white focus:outline-none" 
                        placeholder="Enter your email"
                        bind:value={email}
                        autocomplete="off"
                    />
                </div>
                <div class="p-4 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">BIRTHDAY</Text>
                    <input 
                        type="date" 
                        class="w-full bg-transparent border-b border-[#333333] mt-2 md:mt-[10px] pb-[5px] text-white focus:outline-none"
                        bind:value={birthday}
                        autocomplete="off"
                    />
                </div>
            </div>
        </IdentityCard>

        <Button 
            text={isSaving ? "SAVING..." : "CREATE IDENTITY"} 
            onclick={createIdentity} 
            icon="/icons/savebk-38.svg"
            disabled={isSaving || !displayName.trim() || !handle.trim()}
        />
    {:else if identity}
        <IdentityCard 
            avatar={avatarUrl || "/placeholder.png"} 
            size="large" 
            banner={bannerImage} 
            bannerColor={bannerColorValue} 
            onUploadAvatar={handleAvatarUpload} 
            onChangeBanner={handleBannerChange}
        >
            <div class="flex flex-col gap-2 md:gap-[10px]">
                <!-- Name Field -->
                <div class="flex flex-col md:flex-row gap-2 md:gap-[10px]">
                    <div class="p-4 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} color="#878787">NAME</Text>
                        {#if editing.displayName}
                            <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center mt-2 md:mt-[10px]">
                                <input 
                                    type="text" 
                                    class="flex-1 bg-transparent border-b border-[#333333] pb-[8px] text-white text-lg md:text-[24px] focus:outline-none" 
                                    bind:value={displayName}
                                    autocomplete="off"
                                />
                                <button 
                                    class="px-5 py-2 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full text-[16px] font-medium"
                                    onclick={() => saveField("displayName")}
                                    disabled={isSaving}
                                >
                                    {isSaving ? "..." : "Save"}
                                </button>
                            </div>
                        {:else}
                            <Text type="h" size={24} weight="medium">{identity.displayName}</Text>
                        {/if}
                    </div>

                    <button 
                        onclick={() => { editing.displayName = !editing.displayName }} 
                        class="w-full md:w-auto md:aspect-square flex-grow h-14 md:h-full p-4 md:p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[24px] md:rounded-[32px] flex items-center justify-center" 
                        aria-label="edit name"
                    >
                        {@html editIcon}
                    </button>
                </div>

                <!-- Handle Field -->
                <div class="flex flex-col md:flex-row gap-2 md:gap-[10px]">
                    <div class="p-4 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} color="#878787">HANDLE</Text>
                        {#if editing.handle}
                            <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center mt-2 md:mt-[10px]">
                                <input 
                                    type="text" 
                                    class="flex-1 bg-transparent border-b border-[#333333] pb-[8px] text-white text-lg md:text-[24px] focus:outline-none" 
                                    bind:value={handle}
                                    autocomplete="off"
                                />
                                <button 
                                    class="px-5 py-2 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full text-[16px] font-medium"
                                    onclick={() => saveField("handle")}
                                    disabled={isSaving}
                                >
                                    {isSaving ? "..." : "Save"}
                                </button>
                            </div>
                        {:else}
                            <Text type="h" size={24} weight="medium">@{identity.handle}</Text>
                        {/if}
                    </div>

                    <button 
                        onclick={() => { editing.handle = !editing.handle }} 
                        class="w-full md:w-auto md:aspect-square flex-grow h-14 md:h-full p-4 md:p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[24px] md:rounded-[32px] flex items-center justify-center" 
                        aria-label="edit handle"
                    >
                        {@html editIcon}
                    </button>
                </div>

                <!-- Email Field -->
                <div class="flex flex-col md:flex-row gap-2 md:gap-[10px]">
                    <div class="p-4 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} color="#878787">EMAIL</Text>
                        {#if editing.email}
                            <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center mt-2 md:mt-[10px]">
                                <input 
                                    type="email" 
                                    class="flex-1 bg-transparent border-b border-[#333333] pb-[8px] text-white text-lg md:text-[24px] focus:outline-none" 
                                    bind:value={email}
                                    placeholder="Enter email"
                                    autocomplete="off"
                                />
                                <button 
                                    class="px-5 py-2 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full text-[16px] font-medium"
                                    onclick={() => saveField("email")}
                                    disabled={isSaving}
                                >
                                    {isSaving ? "..." : "Save"}
                                </button>
                            </div>
                        {:else}
                            <Text type="h" size={24} weight="medium">{identity.email || "Not set"}</Text>
                        {/if}
                    </div>

                    <button 
                        onclick={() => { editing.email = !editing.email }} 
                        class="w-full md:w-auto md:aspect-square flex-grow h-14 md:h-full p-4 md:p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[24px] md:rounded-[32px] flex items-center justify-center" 
                        aria-label="edit email"
                    >
                        {@html editIcon}
                    </button>
                </div>

                <!-- Birthday Field -->
                <div class="flex flex-col md:flex-row gap-2 md:gap-[10px]">
                    <div class="p-4 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} color="#878787">BIRTHDAY</Text>
                        {#if editing.birthday}
                            <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center mt-2 md:mt-[10px]">
                                <input 
                                    type="date" 
                                    class="flex-1 bg-transparent border-b border-[#333333] pb-[8px] text-white text-lg md:text-[24px] focus:outline-none" 
                                    bind:value={birthday}
                                    autocomplete="off"
                                />
                                <button 
                                    class="px-5 py-2 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full text-[16px] font-medium"
                                    onclick={() => saveField("birthday")}
                                    disabled={isSaving}
                                >
                                    {isSaving ? "..." : "Save"}
                                </button>
                            </div>
                        {:else}
                            <Text type="h" size={24} weight="medium">{formatBirthday(identity.birthday || "")}</Text>
                        {/if}
                    </div>

                    <button 
                        onclick={() => { editing.birthday = !editing.birthday }} 
                        class="w-full md:w-auto md:aspect-square flex-grow h-14 md:h-full p-4 md:p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[24px] md:rounded-[32px] flex items-center justify-center" 
                        aria-label="edit birthday"
                    >
                        {@html editIcon}
                    </button>
                </div>
            </div>
        </IdentityCard>

        <!-- Delete Identity Section -->
        {#if !identity.isPrimary}
            {#if showDeleteConfirm}
                <div class="p-4 md:p-[30px] bg-[#111111] rounded-[24px] md:rounded-[32px] flex flex-col gap-3 md:gap-[15px]">
                    <Text type="h" size={18} color="#E14747">Delete this identity?</Text>
                    <p class="text-[#878787] text-sm md:text-[14px]">This action cannot be undone. All data associated with this identity will be permanently removed.</p>
                    <div class="flex gap-2 md:gap-[10px] mt-2 md:mt-[10px]">
                        <button 
                            class="flex-1 py-3 md:py-[15px] bg-[#E14747] hover:bg-[#C73E3E] text-white rounded-[16px] text-[14px] font-semibold transition-colors"
                            onclick={deleteIdentity}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                        <button 
                            class="flex-1 py-3 md:py-[15px] bg-[#222222] hover:bg-[#333333] text-white rounded-[16px] text-[14px] font-semibold transition-colors"
                            onclick={() => showDeleteConfirm = false}
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            {:else}
                <button 
                    class="w-full p-4 md:p-[30px] bg-[#111111] hover:bg-[#1a1a1a] rounded-[24px] md:rounded-[32px] text-[#878787] hover:text-[#E14747] transition-colors flex items-center justify-between group"
                    onclick={() => showDeleteConfirm = true}
                >
                    <div class="flex items-center gap-3 md:gap-[15px]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="opacity-60 group-hover:opacity-100 transition-opacity">
                            <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <Text type="h" size={18} color="currentColor">Delete Identity</Text>
                    </div>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="opacity-40 group-hover:opacity-100 transition-opacity">
                        <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            {/if}
        {/if}
    {/if}
</div>
