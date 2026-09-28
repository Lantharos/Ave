<script lang="ts">
    import type { Snippet } from "svelte";
    import AvatarCropModal from "$lib/surfaces/web/components/AvatarCropModal.svelte";
    
    let { 
        avatar, 
        size = "small",
        compact = false,
        onUploadAvatar = (file: File) => {}, 
        editable = true,
        children
    } = $props<{
        avatar: string;
        size?: "small" | "large";
        compact?: boolean;
        onUploadAvatar?: (file: File) => void;
        editable?: boolean;
        children?: Snippet;
    }>();
    
    let avatarInput: HTMLInputElement;
    let cropModalOpen = $state(false);
    let pendingAvatarFile = $state<File | null>(null);
    
    function handleAvatarClick() {
        avatarInput?.click();
    }
    
    function handleAvatarChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
            pendingAvatarFile = file;
            cropModalOpen = true;
        }
        input.value = "";
    }

    function handleAvatarCropCancel() {
        cropModalOpen = false;
        pendingAvatarFile = null;
    }

    function handleAvatarCropConfirm(file: File) {
        cropModalOpen = false;
        pendingAvatarFile = null;
        onUploadAvatar(file);
    }
</script>

<div class="flex flex-col w-full rounded-[16px] {compact ? 'md:rounded-[28px]' : 'md:rounded-[32px]'} overflow-clip relative">
    <input 
        type="file" 
        accept="image/jpeg,image/png,image/gif,image/webp" 
        class="hidden" 
        bind:this={avatarInput}
        onchange={handleAvatarChange}
    />

    <div class="w-full {compact ? 'h-[50px] md:h-[72px]' : size === 'small' ? 'h-[50px] md:h-[100px]' : 'h-[60px] md:h-[150px]' } relative overflow-hidden rounded-t-[12px] md:rounded-t-[15px] bg-[#202020]">
        <img
            src={avatar}
            alt=""
            aria-hidden="true"
            class="absolute inset-0 w-full h-full object-cover scale-150 blur-2xl saturate-150 opacity-80 pointer-events-none select-none"
        />
    </div>

    <div class="{compact ? 'w-[60px] h-[60px] md:w-[88px] md:h-[88px]' : size === 'small' ? 'w-[60px] h-[60px] md:w-[125px] md:h-[125px]' : 'w-[70px] h-[70px] md:w-[160px] md:h-[160px]' } overflow-hidden {compact ? 'mt-[15px] md:mt-[24px] ml-2.5 md:ml-[24px]' : 'mt-[15px] md:mt-[40px] ml-2.5 md:ml-[40px]'} z-10 absolute aspect-square">
        <img src={avatar} alt="avatar" class="w-full h-full aspect-square border-2 {compact ? 'md:border-[4px]' : 'md:border-[6px]'} border-[#171717] rounded-[12px] {compact ? 'md:rounded-[24px]' : 'md:rounded-[32px]'} object-cover transition-transform duration-300 ease-in-out" />

        {#if editable}
            <button 
                aria-label="edit avatar" 
                class="w-[24px] h-[24px] md:w-[36px] md:h-[36px] rounded-[7px] md:rounded-[12px] bg-[#202020]/70 flex flex-col items-center justify-center absolute bottom-1.5 md:bottom-[15px] right-1.5 md:right-[20px] hover:bg-[#202020]/90 transition-colors duration-300 cursor-pointer"
                onclick={handleAvatarClick}
            >
                <svg class="w-3.5 h-3.5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3V15M12 3L17 8M12 3L7 8M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19L3 15" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        {/if}
    </div>

    <div class="w-full bg-[#171717] flex flex-col p-2.5 {compact ? 'md:p-[24px]' : 'md:p-[40px]'} pt-[35px] {compact ? 'md:pt-[56px]' : 'md:pt-[80px]'}">
        {#if children}
            {@render children()}
        {/if}
    </div>
</div>

<AvatarCropModal
    file={pendingAvatarFile}
    open={cropModalOpen}
    onCancel={handleAvatarCropCancel}
    onConfirm={handleAvatarCropConfirm}
/>
