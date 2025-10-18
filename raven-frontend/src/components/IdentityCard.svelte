<script lang="ts">
    export let banner: string | undefined;
    export let bannerColor: string | undefined = "#CCCCCC";
    export let avatar: string;
    export let onUploadAvatar: (file: File) => void;
    export let onChangeBanner: (fileOrHex: File | string) => void;

    let avatarInput: HTMLInputElement;
    let bannerInput: HTMLInputElement;
</script>

<div class="flex flex-col w-full rounded-[32px] overflow-clip">
    <div class="w-full h-[100px] relative overflow-hidden rounded-t-[15px]">
        {#if banner}
            <img src={banner} alt="banner" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300 ease-in-out" />
        {:else}
            <div class="w-full h-full" style="background-color: {bannerColor};"></div>
        {/if}
    </div>

    <div class="w-[125px] h-[125px] rounded-[32px] border-[6px] border-[#171717] overflow-hidden mt-[40px] ml-[40px] z-10 absolute">
        <img src={avatar} alt="avatar" class="w-full h-full object-cover transition-transform duration-300 ease-in-out" />
    </div>

    <div class="w-full bg-[#171717] flex flex-col p-[40px] pt-[80px]">
        <slot />
    </div>
</div>