<script lang="ts">
    export let banner: string | undefined;
    export let bannerColor: string | undefined = "#CCCCCC";
    export let avatar: string;
    export let size: "small" | "large" = "small";
    export let onUploadAvatar: (file: File) => void;
    export let onChangeBanner: (fileOrHex: File | string) => void;

    let avatarInput: HTMLInputElement;
    let bannerInput: HTMLInputElement;
</script>

<div class="flex flex-col w-full rounded-[32px] overflow-clip">
    <div class="w-full {size === 'small' ? 'h-[100px]' : 'h-[150px]' } relative overflow-hidden rounded-t-[15px]">
        {#if banner}
            <img src={banner} alt="banner" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300 ease-in-out" />
        {:else}
            <div class="w-full h-full" style="background-color: {bannerColor};"></div>
        {/if}

        <button aria-label="edit banner" class="w-[40px] h-[40px] rounded-[15px] bg-[#202020]/70 flex flex-col items-center justify-center absolute bottom-[10px] right-[10px] hover:bg-[#202020]/90 transition-colors duration-300 cursor-pointer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C9.34784 2 6.8043 3.05357 4.92893 4.92893C3.05357 6.8043 2 9.34784 2 12C2 14.6522 3.05357 17.1957 4.92893 19.0711C6.8043 20.9464 9.34784 22 12 22C14.6522 22 17.1957 21.0518 19.0711 19.364C20.9464 17.6761 22 15.3869 22 13C22 11.6739 21.4732 10.4021 20.5355 9.46447C19.5979 8.52678 18.3261 8 17 8H14.75C14.425 8 14.1064 7.9095 13.83 7.73864C13.5535 7.56778 13.3301 7.32331 13.1848 7.03262C13.0394 6.74194 12.9779 6.41652 13.0071 6.09284C13.0363 5.76916 13.155 5.46 13.35 5.2L13.65 4.8C13.845 4.54 13.9637 4.23084 13.9929 3.90716C14.0221 3.58348 13.9606 3.25806 13.8152 2.96738C13.6699 2.67669 13.4465 2.43222 13.17 2.26136C12.8936 2.0905 12.575 2 12.25 2H12Z" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M13.5 17C13.7761 17 14 17.2239 14 17.5C14 17.7761 13.7761 18 13.5 18C13.2239 18 13 17.7761 13 17.5C13 17.2239 13.2239 17 13.5 17Z" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M17.5 13C17.7761 13 18 13.2239 18 13.5C18 13.7761 17.7761 14 17.5 14C17.2239 14 17 13.7761 17 13.5C17 13.2239 17.2239 13 17.5 13Z" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M6.5 11C6.77614 11 7 11.2239 7 11.5C7 11.7761 6.77614 12 6.5 12C6.22386 12 6 11.7761 6 11.5C6 11.2239 6.22386 11 6.5 11Z" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8.5 16C8.77614 16 9 16.2239 9 16.5C9 16.7761 8.77614 17 8.5 17C8.22386 17 8 16.7761 8 16.5C8 16.2239 8.22386 16 8.5 16Z" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    </div>

    <div class="{size === 'small' ? 'w-[125px] h-[125px]' : 'w-[160px] h-[160px]' } overflow-hidden mt-[40px] ml-[40px] z-10 absolute">
        <img src={avatar} alt="avatar" class="w-full h-full border-[6px] border-[#171717] rounded-[32px] object-cover transition-transform duration-300 ease-in-out" />

        <button aria-label="edit avatar" class="w-[36px] h-[36px] rounded-[12px] bg-[#202020]/70 flex flex-col items-center justify-center absolute bottom-[15px] right-[20px] hover:bg-[#202020]/90 transition-colors duration-300 cursor-pointer">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3V15M12 3L17 8M12 3L7 8M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19L3 15" stroke="white" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    </div>

    <div class="w-full bg-[#171717] flex flex-col p-[40px] pt-[80px]">
        <slot />
    </div>
</div>