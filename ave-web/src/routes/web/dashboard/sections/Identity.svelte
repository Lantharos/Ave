<script lang="ts">
import Text from "$lib/surfaces/web/components/Text.svelte";
import IdentityCard from "$lib/surfaces/web/components/IdentityCard.svelte";
import Button from "$lib/surfaces/web/components/Button.svelte";
import { Save } from "@lucide/svelte";
import type { Identity as IdentityType } from "$lib/surfaces/web/lib/api";
let { newIdentity = false, identity = null } = $props<{
        newIdentity?: boolean;
        identity?: IdentityType | null;
    }>();
import { createIdentityEditor } from "./identity/identity-editor.svelte";
const flow = createIdentityEditor(() => identity);
</script>

{#snippet editIcon()}
    <svg class="w-5 h-5 md:w-[42px] md:h-[42px]" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M26.25 8.75006L33.25 15.7501M37.0545 11.9211C37.9798 10.996 38.4996 9.74137 38.4998 8.43305C38.5 7.12473 37.9804 5.86992 37.0554 4.94468C36.1304 4.01944 34.8757 3.49955 33.5674 3.49939C32.2591 3.49923 31.0043 4.0188 30.079 4.94381L6.72351 28.3046C6.31719 28.7097 6.01671 29.2085 5.84851 29.7571L3.53676 37.3731C3.49153 37.5244 3.48811 37.6852 3.52687 37.8383C3.56563 37.9914 3.64512 38.1312 3.7569 38.2428C3.86868 38.3544 4.00859 38.4337 4.16178 38.4722C4.31498 38.5107 4.47574 38.507 4.62701 38.4616L12.2448 36.1516C12.7928 35.9849 13.2916 35.6862 13.6973 35.2818L37.0545 11.9211Z" stroke="white" stroke-opacity="0.8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
{/snippet}

<div class="flex flex-col gap-4 md:gap-[40px] w-full z-10 p-3 md:p-[60px] bg-[#111111]/60 rounded-[24px] md:rounded-[64px] backdrop-blur-[20px]">
    {#if flow.error}
        <div class="bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-2xl">
            {flow.error}
        </div>
    {/if}

    {#if flow.success}
        <div class="bg-[#32A94C]/20 border border-[#32A94C] text-[#32A94C] px-4 py-3 rounded-2xl">
            {flow.success}
        </div>
    {/if}

    {#if newIdentity}
        <IdentityCard
            avatar={flow.avatarUrl || "/placeholder.png"}
            size="large"
            onUploadAvatar={flow.handleAvatarUpload}
        >
            <div class="flex flex-col gap-2 md:gap-[10px]">
                <div class="p-3 md:p-[30px] bg-[#111111] rounded-[16px] md:rounded-[32px]">
                    <Text type="hd" size={16} mobileSize={12} color="#878787">NAME *</Text>
                    <input
                        type="text"
                        class="w-full bg-transparent border-b border-[#333333] mt-2 md:mt-[10px] pb-[5px] text-white focus:outline-none"
                        placeholder="Enter your name"
                        bind:value={flow.displayName}
                        autocomplete="off"
                    />
                </div>
                <div class="p-3 md:p-[30px] bg-[#111111] rounded-[16px] md:rounded-[32px]">
                    <Text type="hd" size={16} mobileSize={12} color="#878787">HANDLE *</Text>
                    <input
                        type="text"
                        class="w-full bg-transparent border-b border-[#333333] mt-2 md:mt-[10px] pb-[5px] text-white focus:outline-none"
                        placeholder="Enter your handle"
                        bind:value={flow.handle}
                        autocomplete="off"
                    />
                </div>
                <div class="p-3 md:p-[30px] bg-[#111111] rounded-[16px] md:rounded-[32px]">
                    <Text type="hd" size={16} mobileSize={12} color="#878787">EMAIL</Text>
                    <input
                        type="email"
                        class="w-full bg-transparent border-b border-[#333333] mt-2 md:mt-[10px] pb-[5px] text-white focus:outline-none"
                        placeholder="Enter your email"
                        bind:value={flow.email}
                        autocomplete="off"
                    />
                </div>
                <div class="p-3 md:p-[30px] bg-[#111111] rounded-[16px] md:rounded-[32px]">
                    <Text type="hd" size={16} mobileSize={12} color="#878787">BIRTHDAY</Text>
                    <input
                        type="date"
                        class="w-full bg-transparent border-b border-[#333333] mt-2 md:mt-[10px] pb-[5px] text-white focus:outline-none"
                        bind:value={flow.birthday}
                        autocomplete="off"
                    />
                </div>
            </div>
        </IdentityCard>

        <Button
            text={flow.isSaving ? "SAVING..." : "CREATE IDENTITY"}
            onclick={flow.createIdentity}
            Icon={Save}
            iconStrokeWidth={2.5}
            disabled={flow.isSaving || !flow.displayName.trim() || !flow.handle.trim()}
        />
    {:else if identity}
        <IdentityCard
            avatar={flow.avatarUrl || "/placeholder.png"}
            size="large"
            onUploadAvatar={flow.handleAvatarUpload}
        >
            <div class="flex flex-col gap-2 md:gap-[10px]">
                <!-- Name Field -->
                <div class="flex flex-col md:flex-row gap-2 md:gap-[10px]">
                    <div class="p-3 md:p-[30px] bg-[#111111] rounded-[16px] md:rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} mobileSize={12} color="#878787">NAME</Text>
                        {#if flow.editing.displayName}
                            <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center mt-2 md:mt-[10px]">
                                <input
                                    type="text"
                                    class="flex-1 bg-transparent border-b border-[#333333] pb-[8px] text-white text-lg md:text-[24px] focus:outline-none"
                                    bind:value={flow.displayName}
                                    autocomplete="off"
                                />
                                <button
                                    class="px-5 py-2 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full text-[16px] font-medium"
                                    onclick={() => flow.saveField("displayName")}
                                    disabled={flow.isSaving}
                                >
                                    {flow.isSaving ? "..." : "Save"}
                                </button>
                            </div>
                        {:else}
                            <Text type="h" size={24} mobileSize={16} weight="medium">{identity.displayName}</Text>
                        {/if}
                    </div>

                    <button
                        onclick={() => { flow.editing.displayName = !flow.editing.displayName }}
                        class="w-full md:w-auto md:aspect-square flex-grow h-12 md:h-full p-3 md:p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[16px] md:rounded-[32px] flex items-center justify-center"
                        aria-label="edit name"
                    >
                        {@render editIcon()}
                    </button>
                </div>

                <!-- Handle Field -->
                <div class="flex flex-col md:flex-row gap-2 md:gap-[10px]">
                    <div class="p-3 md:p-[30px] bg-[#111111] rounded-[16px] md:rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} mobileSize={12} color="#878787">HANDLE</Text>
                        {#if flow.editing.handle}
                            <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center mt-2 md:mt-[10px]">
                                <input
                                    type="text"
                                    class="flex-1 bg-transparent border-b border-[#333333] pb-[8px] text-white text-lg md:text-[24px] focus:outline-none"
                                    bind:value={flow.handle}
                                    autocomplete="off"
                                />
                                <button
                                    class="px-5 py-2 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full text-[16px] font-medium"
                                    onclick={() => flow.saveField("handle")}
                                    disabled={flow.isSaving}
                                >
                                    {flow.isSaving ? "..." : "Save"}
                                </button>
                            </div>
                        {:else}
                            <Text type="h" size={24} mobileSize={16} weight="medium">@{identity.handle}</Text>
                        {/if}
                    </div>

                    <button
                        onclick={() => { flow.editing.handle = !flow.editing.handle }}
                        class="w-full md:w-auto md:aspect-square flex-grow h-12 md:h-full p-3 md:p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[16px] md:rounded-[32px] flex items-center justify-center"
                        aria-label="edit handle"
                    >
                        {@render editIcon()}
                    </button>
                </div>

                <!-- Email Field -->
                <div class="flex flex-col md:flex-row gap-2 md:gap-[10px]">
                    <div class="p-3 md:p-[30px] bg-[#111111] rounded-[16px] md:rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} mobileSize={12} color="#878787">EMAIL</Text>
                        {#if flow.editing.email}
                            <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center mt-2 md:mt-[10px]">
                                <input
                                    type="email"
                                    class="flex-1 bg-transparent border-b border-[#333333] pb-[8px] text-white text-lg md:text-[24px] focus:outline-none"
                                    bind:value={flow.email}
                                    placeholder="Enter email"
                                    autocomplete="off"
                                />
                                <button
                                    class="px-5 py-2 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full text-[16px] font-medium"
                                    onclick={flow.startEmailVerification}
                                    disabled={flow.isSaving}
                                >
                                    {flow.isSaving ? "..." : "Continue"}
                                </button>
                            </div>
                        {:else}
                            <div class="flex flex-row flex-wrap items-center gap-2 md:gap-[14px]">
                                <Text type="h" size={24} mobileSize={16} weight="medium">{flow.displayedEmail}</Text>
                                {#if flow.emailIsPending}
                                    <span class="text-[#D2AC57] text-sm md:text-[16px] font-semibold">UNVERIFIED</span>
                                {:else if identity.email}
                                    <svg class="w-5 h-5 md:w-[28px] md:h-[28px]" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="email verified">
                                        <circle cx="24" cy="24" r="16" stroke="white" stroke-opacity="0.85" stroke-width="4.5"/>
                                        <path d="M17.5 24.5L22 29L30.5 20.5" stroke="white" stroke-opacity="0.85" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                {/if}
                            </div>
                        {/if}
                    </div>

                    {#if !flow.editing.email && flow.emailIsPending}
                        <button
                            onclick={() => {
                                flow.showEmailVerificationModal = true;
                            }}
                            class="{flow.emailActionButtonClass} cursor-pointer"
                            aria-label="verify email"
                        >
                            <svg class="w-6 h-6 md:w-[48px] md:h-[48px]" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="24" cy="24" r="16" stroke="white" stroke-opacity="0.85" stroke-width="4.5"/>
                                <path d="M24 15.5V24.5" stroke="white" stroke-opacity="0.85" stroke-width="4.5" stroke-linecap="round"/>
                                <circle cx="24" cy="31.5" r="2.25" fill="white" fill-opacity="0.85"/>
                            </svg>
                        </button>
                    {/if}

                    <button
                        onclick={() => { flow.editing.email = !flow.editing.email; flow.showEmailVerificationModal = false; }}
                        class="{flow.emailActionButtonClass} cursor-pointer"
                        aria-label="edit email"
                    >
                        {@render editIcon()}
                    </button>
                </div>

                <!-- Birthday Field -->
                <div class="flex flex-col md:flex-row gap-2 md:gap-[10px]">
                    <div class="p-3 md:p-[30px] bg-[#111111] rounded-[16px] md:rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} mobileSize={12} color="#878787">BIRTHDAY</Text>
                        {#if flow.editing.birthday}
                            <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center mt-2 md:mt-[10px]">
                                <input
                                    type="date"
                                    class="flex-1 bg-transparent border-b border-[#333333] pb-[8px] text-white text-lg md:text-[24px] focus:outline-none"
                                    bind:value={flow.birthday}
                                    autocomplete="off"
                                />
                                <button
                                    class="px-5 py-2 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full text-[16px] font-medium"
                                    onclick={() => flow.saveField("birthday")}
                                    disabled={flow.isSaving}
                                >
                                    {flow.isSaving ? "..." : "Save"}
                                </button>
                            </div>
                        {:else}
                            <Text type="h" size={24} mobileSize={16} weight="medium">{flow.formatBirthday(identity.birthday || "")}</Text>
                        {/if}
                    </div>

                    <button
                        onclick={() => { flow.editing.birthday = !flow.editing.birthday }}
                        class="w-full md:w-auto md:aspect-square flex-grow h-12 md:h-full p-3 md:p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[16px] md:rounded-[32px] flex items-center justify-center"
                        aria-label="edit birthday"
                    >
                        {@render editIcon()}
                    </button>
                </div>
            </div>
        </IdentityCard>

        <!-- Delete Identity Section -->
        {#if !identity.isPrimary}
            {#if flow.showDeleteConfirm}
                <div class="p-3 md:p-[30px] bg-[#111111] rounded-[16px] md:rounded-[32px] flex flex-col gap-3 md:gap-[15px]">
                    <Text type="h" size={18} color="#E14747">Delete this identity?</Text>
                    <p class="text-[#878787] text-sm md:text-[14px]">This action cannot be undone. All data associated with this identity will be permanently removed.</p>
                    <div class="flex gap-2 md:gap-[10px] mt-2 md:mt-[10px]">
                        <button
                            class="flex-1 py-3 md:py-[15px] bg-[#E14747] hover:bg-[#C73E3E] text-white rounded-[16px] text-[14px] font-semibold transition-colors"
                            onclick={flow.deleteIdentity}
                            disabled={flow.isDeleting}
                        >
                            {flow.isDeleting ? "Deleting..." : "Delete"}
                        </button>
                        <button
                            class="flex-1 py-3 md:py-[15px] bg-[#222222] hover:bg-[#333333] text-white rounded-[16px] text-[14px] font-semibold transition-colors"
                            onclick={() => flow.showDeleteConfirm = false}
                            disabled={flow.isDeleting}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            {:else}
                <button
                    class="w-full p-4 md:p-[30px] bg-[#111111] hover:bg-[#1a1a1a] rounded-[24px] md:rounded-[32px] text-[#878787] hover:text-[#E14747] transition-colors flex items-center justify-between group"
                    onclick={() => flow.showDeleteConfirm = true}
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

{#if flow.showEmailVerificationModal && identity && flow.emailIsPending}
    <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onclick={() => flow.showEmailVerificationModal = false}
        onkeydown={(e) => e.key === "Escape" && (flow.showEmailVerificationModal = false)}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
        <div
            class="bg-[#171717] rounded-[24px] md:rounded-[36px] p-6 md:p-[40px] max-w-[520px] w-full min-w-0 overflow-x-hidden"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
            role="presentation"
        >
            <Text type="h" size={24} weight="bold">Verify your email</Text>
            <p class="text-[#878787] text-sm md:text-[16px] mt-2 md:mt-[10px]">
                Enter the 6-digit code we sent to {identity.pendingEmail}.
            </p>

            <div class="mt-6 md:mt-[28px] flex flex-col gap-4">
                <div class="p-4 md:p-[22px] bg-[#111111] rounded-[18px] md:rounded-[24px]">
                    <Text type="hd" size={14} mobileSize={12} color="#878787">EMAIL</Text>
                    <Text type="h" size={22} mobileSize={16} color="#FFFFFF">{identity.pendingEmail}</Text>
                </div>

                <div class="flex flex-col gap-3 min-w-0">
                    <input
                        type="text"
                        inputmode="numeric"
                        maxlength="6"
                        class="w-full min-w-0 bg-transparent border-b border-[#333333] pb-[10px] text-white text-lg md:text-[24px] focus:outline-none"
                        bind:value={flow.verificationCode}
                        placeholder="Enter code"
                        autocomplete="one-time-code"
                    />
                    <button
                        type="button"
                        class="w-full sm:w-auto sm:self-end shrink-0 px-5 py-3 bg-[#FFFFFF] hover:bg-[#E0E0E0] text-[#090909] rounded-full text-[16px] font-medium disabled:opacity-60"
                        onclick={flow.verifyEmail}
                        disabled={flow.isSaving || flow.verificationCode.trim().length !== 6}
                    >
                        {flow.isSaving ? "..." : "Verify"}
                    </button>
                </div>
            </div>

            <div class="flex flex-col md:flex-row gap-2 md:gap-[10px] mt-6 md:mt-[30px]">
                <button
                    type="button"
                    class="flex-1 py-3 md:py-[15px] bg-[#FFFFFF] text-[#090909] font-semibold rounded-[16px] hover:bg-[#E0E0E0] transition-colors disabled:opacity-60"
                    onclick={flow.resendEmailVerification}
                    disabled={flow.isSaving}
                >
                    Resend code
                </button>
                <button
                    type="button"
                    class="flex-1 py-3 md:py-[15px] bg-[#111111] text-[#FFFFFF] font-semibold rounded-[16px] hover:bg-[#202020] transition-colors disabled:opacity-60"
                    onclick={() => {
                        flow.email = identity.pendingEmail || "";
                        flow.showEmailVerificationModal = false;
                        flow.editing.email = true;
                    }}
                    disabled={flow.isSaving}
                >
                    Change email
                </button>
                <button
                    type="button"
                    class="flex-1 py-3 md:py-[15px] bg-[#111111] text-[#878787] font-semibold rounded-[16px] hover:bg-[#202020] hover:text-[#FFFFFF] transition-colors disabled:opacity-60"
                    onclick={flow.clearEmail}
                    disabled={flow.isSaving}
                >
                    Clear
                </button>
            </div>
        </div>
    </div>
{/if}
