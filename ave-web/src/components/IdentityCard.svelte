<script lang="ts">
    import type { Snippet } from "svelte";
    
    let { 
        banner = undefined, 
        bannerColor = "#CCCCCC", 
        avatar, 
        size = "small", 
        onUploadAvatar = (file: File) => {}, 
        onChangeBanner = (fileOrHex: File | string) => {},
        editable = true,
        children
    } = $props<{
        banner?: string;
        bannerColor?: string;
        avatar: string;
        size?: "small" | "large";
        onUploadAvatar?: (file: File) => void;
        onChangeBanner?: (fileOrHex: File | string) => void;
        editable?: boolean;
        children?: Snippet;
    }>();
    
    let avatarInput: HTMLInputElement;
    let bannerInput: HTMLInputElement;
    let bannerButton = $state<HTMLButtonElement | null>(null);
    let showColorPicker = $state(false);
    let customColor = $state(bannerColor || "#CCCCCC");
    let pickerPosition = $state({ top: 0, right: 0 });
    
    // Preset colors for the palette
    const presetColors = [
        "#B9BBBE", // Default gray
        "#FF6B6B", // Red
        "#FFB400", // Orange/Yellow
        "#32A94C", // Green
        "#4ECDC4", // Teal
        "#45B7D1", // Light blue
        "#5865F2", // Discord blue
        "#9B59B6", // Purple
        "#E91E63", // Pink
        "#2C3E50", // Dark blue
        "#1A1A2E", // Dark purple
        "#16213E", // Navy
    ];
    
    function handleAvatarClick() {
        avatarInput?.click();
    }
    
    function handleAvatarChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
            onUploadAvatar(file);
        }
        // Reset input so same file can be selected again
        input.value = "";
    }
    
    function handleBannerClick(e: MouseEvent) {
        e.stopPropagation();
        
        if (!showColorPicker && bannerButton) {
            // Calculate position relative to viewport
            const rect = bannerButton.getBoundingClientRect();
            const dropdownWidth = 220;
            
            // Position below the button, aligned to the right edge
            // But ensure it doesn't go off-screen
            let right = window.innerWidth - rect.right;
            if (right < 10) right = 10;
            if (rect.right - dropdownWidth < 10) {
                // If dropdown would go off left edge, align to left of button instead
                right = window.innerWidth - rect.left - dropdownWidth;
            }
            
            pickerPosition = {
                top: rect.bottom + 10, // 10px below button
                right: right
            };
        }
        
        showColorPicker = !showColorPicker;
    }
    
    function handleBannerImageClick() {
        bannerInput?.click();
        showColorPicker = false;
    }
    
    function handleBannerChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
            onChangeBanner(file);
        }
        input.value = "";
    }
    
    function selectColor(color: string) {
        customColor = color;
        onChangeBanner(color);
        showColorPicker = false;
    }
    
    function handleCustomColorChange(e: Event) {
        const input = e.target as HTMLInputElement;
        customColor = input.value;
    }
    
    function applyCustomColor() {
        onChangeBanner(customColor);
        showColorPicker = false;
    }
    
    // Update customColor when bannerColor prop changes
    $effect(() => {
        if (bannerColor) {
            customColor = bannerColor;
        }
    });
</script>

<svelte:window onclick={(e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.color-picker-container') && !target.closest('.color-picker-dropdown')) {
        showColorPicker = false;
    }
}} />

<div class="flex flex-col w-full rounded-[32px] overflow-clip relative">
    <!-- Hidden file inputs -->
    <input 
        type="file" 
        accept="image/jpeg,image/png,image/gif,image/webp" 
        class="hidden" 
        bind:this={avatarInput}
        onchange={handleAvatarChange}
    />
    <input 
        type="file" 
        accept="image/jpeg,image/png,image/gif,image/webp" 
        class="hidden" 
        bind:this={bannerInput}
        onchange={handleBannerChange}
    />

    <div class="w-full {size === 'small' ? 'h-[100px]' : 'h-[150px]' } relative overflow-hidden rounded-t-[15px]">
        {#if banner}
            <img src={banner} alt="banner" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300 ease-in-out" />
        {:else}
            <div class="w-full h-full" style="background-color: {bannerColor};"></div>
        {/if}

        {#if editable}
            <div class="color-picker-container">
                <button 
                    bind:this={bannerButton}
                    aria-label="edit banner" 
                    class="w-[40px] h-[40px] rounded-[15px] bg-[#202020]/70 flex flex-col items-center justify-center absolute bottom-[10px] right-[10px] hover:bg-[#202020]/90 transition-colors duration-300 cursor-pointer z-10"
                    onclick={handleBannerClick}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C9.34784 2 6.8043 3.05357 4.92893 4.92893C3.05357 6.8043 2 9.34784 2 12C2 14.6522 3.05357 17.1957 4.92893 19.0711C6.8043 20.9464 9.34784 22 12 22C14.6522 22 17.1957 21.0518 19.0711 19.364C20.9464 17.6761 22 15.3869 22 13C22 11.6739 21.4732 10.4021 20.5355 9.46447C19.5979 8.52678 18.3261 8 17 8H14.75C14.425 8 14.1064 7.9095 13.83 7.73864C13.5535 7.56778 13.3301 7.32331 13.1848 7.03262C13.0394 6.74194 12.9779 6.41652 13.0071 6.09284C13.0363 5.76916 13.155 5.46 13.35 5.2L13.65 4.8C13.845 4.54 13.9637 4.23084 13.9929 3.90716C14.0221 3.58348 13.9606 3.25806 13.8152 2.96738C13.6699 2.67669 13.4465 2.43222 13.17 2.26136C12.8936 2.0905 12.575 2 12.25 2H12Z" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M13.5 17C13.7761 17 14 17.2239 14 17.5C14 17.7761 13.7761 18 13.5 18C13.2239 18 13 17.7761 13 17.5C13 17.2239 13.2239 17 13.5 17Z" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M17.5 13C17.7761 13 18 13.2239 18 13.5C18 13.7761 17.7761 14 17.5 14C17.2239 14 17 13.7761 17 13.5C17 13.2239 17.2239 13 17.5 13Z" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M6.5 11C6.77614 11 7 11.2239 7 11.5C7 11.7761 6.77614 12 6.5 12C6.22386 12 6 11.7761 6 11.5C6 11.2239 6.22386 11 6.5 11Z" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M8.5 16C8.77614 16 9 16.2239 9 16.5C9 16.7761 8.77614 17 8.5 17C8.22386 17 8 16.7761 8 16.5C8 16.2239 8.22386 16 8.5 16Z" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        {/if}
    </div>

    <div class="{size === 'small' ? 'w-[125px] h-[125px]' : 'w-[160px] h-[160px]' } overflow-hidden mt-[40px] ml-[40px] z-10 absolute">
        <img src={avatar} alt="avatar" class="w-full h-full border-[6px] border-[#171717] rounded-[32px] object-cover transition-transform duration-300 ease-in-out" />

        {#if editable}
            <button 
                aria-label="edit avatar" 
                class="w-[36px] h-[36px] rounded-[12px] bg-[#202020]/70 flex flex-col items-center justify-center absolute bottom-[15px] right-[20px] hover:bg-[#202020]/90 transition-colors duration-300 cursor-pointer"
                onclick={handleAvatarClick}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 3V15M12 3L17 8M12 3L7 8M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19L3 15" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        {/if}
    </div>

    <div class="w-full bg-[#171717] flex flex-col p-[40px] pt-[80px]">
        {#if children}
            {@render children()}
        {/if}
    </div>
</div>

<!-- Color Picker Dropdown - Rendered as fixed overlay outside card -->
{#if showColorPicker}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
        class="color-picker-dropdown fixed bg-[#171717] rounded-[16px] p-[15px] shadow-xl border border-[#333333] z-[9999] w-[220px]"
        style="top: {pickerPosition.top}px; right: {pickerPosition.right}px;"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.key === "Escape" && (showColorPicker = false)}
        role="menu"
        tabindex="-1"
    >
        <p class="text-[#878787] text-[12px] font-semibold mb-[10px]">BANNER COLOR</p>
        
        <!-- Preset Colors Grid -->
        <div class="grid grid-cols-6 gap-[8px] mb-[15px]">
            {#each presetColors as color}
                <button
                    class="w-[28px] h-[28px] rounded-[8px] border-2 transition-transform hover:scale-110 {color === customColor ? 'border-white' : 'border-transparent'}"
                    style="background-color: {color};"
                    onclick={() => selectColor(color)}
                    aria-label="Select color {color}"
                ></button>
            {/each}
        </div>
        
        <!-- Custom Color Input -->
        <div class="flex items-center gap-[8px] mb-[15px]">
            <input 
                type="color" 
                class="w-[36px] h-[36px] rounded-[8px] cursor-pointer border-0 p-0"
                value={customColor}
                oninput={handleCustomColorChange}
            />
            <input 
                type="text" 
                class="flex-1 bg-[#111111] text-white text-[14px] px-[10px] py-[8px] rounded-[8px] border border-[#333333] focus:outline-none focus:border-[#555555] uppercase"
                value={customColor}
                oninput={(e) => customColor = (e.target as HTMLInputElement).value}
                maxlength={7}
            />
            <button 
                class="px-[12px] py-[8px] bg-[#FFFFFF] text-[#090909] text-[12px] font-semibold rounded-[8px] hover:bg-[#E0E0E0] transition-colors"
                onclick={applyCustomColor}
            >
                Apply
            </button>
        </div>
        
        <!-- Upload Image Option -->
        <button 
            class="w-full flex items-center gap-[10px] px-[12px] py-[10px] bg-[#111111] hover:bg-[#222222] rounded-[8px] transition-colors text-left"
            onclick={handleBannerImageClick}
        >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M17 8L12 3L7 8" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 3V15" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="text-[#FFFFFF] text-[14px]">Upload Image</span>
        </button>
    </div>
{/if}
