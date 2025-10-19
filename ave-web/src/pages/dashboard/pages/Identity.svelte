<script>
    import Text from "../../../components/Text.svelte";
    import IdentityCard from "../../../components/IdentityCard.svelte";
    import Button from "../../../components/Button.svelte";

    export let newIdentity = false;
    export let identity = {
        name: "Niko Arden",
        handle: "arden",
        email: "",
        birthday: "",
        avatar: "/placeholder.png",
        banner: "",
        bannerColor: "#B9BBBE"
    };

    let editing = {
        name: false,
        handle: false,
        email: false,
        birthday: false
    };
</script>

<div class="flex flex-col gap-[40px] w-full z-10 p-[60px] bg-[#111111]/60 rounded-[64px] backdrop-blur-[20px]">
    {#if newIdentity}
        <IdentityCard avatar="/placeholder.png" banner="" bannerColor="#B9BBBE" size="large" onUploadAvatar={(file) => {}} onChangeBanner={(fileOrHex) => {}}>
            <div class="flex flex-col gap-[10px]">
                <div class="p-[30px] bg-[#111111] rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">NAME</Text>
                    <input type="text" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" placeholder="Enter your name" />
                </div>
                <div class="p-[30px] bg-[#111111] rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">HANDLE</Text>
                    <input type="text" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" placeholder="Enter your handle" />
                </div>
                <div class="p-[30px] bg-[#111111] rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">EMAIL</Text>
                    <input type="text" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" placeholder="Enter your email" />
                </div>
                <div class="p-[30px] bg-[#111111] rounded-[32px]">
                    <Text type="hd" size={16} color="#878787">BIRTHDAY</Text>
                    <input type="date" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" />
                </div>
            </div>
        </IdentityCard>

        <Button text="SAVE" onclick={() => {}} icon="/icons/savebk-38.svg" />
    {:else}
        <IdentityCard avatar="/placeholder.png" size="large" banner="" bannerColor="#B9BBBE" onUploadAvatar={(file) => {}} onChangeBanner={(fileOrHex) => {}}>
            <div class="flex flex-col gap-[10px]">
                <div class="flex flex-row gap-[10px]">
                    <div class="p-[30px] bg-[#111111] rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} color="#878787">NAME</Text>
                        {#if editing.name}
                            <input type="text" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" placeholder="Enter your name" />
                        {:else}
                            <Text type="h" size={24} weight="medium">Niko Arden</Text>
                        {/if}
                    </div>

                    <button onclick={() => { editing.name = !editing.name }} class="aspect-square flex-grow h-full p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[32px] flex items-center justify-center" aria-label="edit name">
                        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g clip-path="url(#clip0_3396_259)">
                                <path d="M26.25 8.75006L33.25 15.7501M37.0545 11.9211C37.9798 10.996 38.4996 9.74137 38.4998 8.43305C38.5 7.12473 37.9804 5.86992 37.0554 4.94468C36.1304 4.01944 34.8757 3.49955 33.5674 3.49939C32.2591 3.49923 31.0043 4.0188 30.079 4.94381L6.72351 28.3046C6.31719 28.7097 6.01671 29.2085 5.84851 29.7571L3.53676 37.3731C3.49153 37.5244 3.48811 37.6852 3.52687 37.8383C3.56563 37.9914 3.64512 38.1312 3.7569 38.2428C3.86868 38.3544 4.00859 38.4337 4.16178 38.4722C4.31498 38.5107 4.47574 38.507 4.62701 38.4616L12.2448 36.1516C12.7928 35.9849 13.2916 35.6862 13.6973 35.2818L37.0545 11.9211Z" stroke="white" stroke-opacity="0.8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                            </g>
                            <defs>
                                <clipPath id="clip0_3396_259">
                                    <rect width="42" height="42" fill="white"/>
                                </clipPath>
                            </defs>
                        </svg>
                    </button>
                </div>
                <div class="flex flex-row gap-[10px]">
                    <div class="p-[30px] bg-[#111111] rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} color="#878787">HANDLE</Text>
                        {#if editing.handle}
                            <input type="text" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" placeholder="Enter your handle" />
                        {:else}
                            <Text type="h" size={24} weight="medium">arden</Text>
                        {/if}
                    </div>

                    <button onclick={() => { editing.handle = !editing.handle }} class="aspect-square flex-grow h-full p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[32px] flex items-center justify-center" aria-label="edit name">
                        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g clip-path="url(#clip0_3396_259)">
                                <path d="M26.25 8.75006L33.25 15.7501M37.0545 11.9211C37.9798 10.996 38.4996 9.74137 38.4998 8.43305C38.5 7.12473 37.9804 5.86992 37.0554 4.94468C36.1304 4.01944 34.8757 3.49955 33.5674 3.49939C32.2591 3.49923 31.0043 4.0188 30.079 4.94381L6.72351 28.3046C6.31719 28.7097 6.01671 29.2085 5.84851 29.7571L3.53676 37.3731C3.49153 37.5244 3.48811 37.6852 3.52687 37.8383C3.56563 37.9914 3.64512 38.1312 3.7569 38.2428C3.86868 38.3544 4.00859 38.4337 4.16178 38.4722C4.31498 38.5107 4.47574 38.507 4.62701 38.4616L12.2448 36.1516C12.7928 35.9849 13.2916 35.6862 13.6973 35.2818L37.0545 11.9211Z" stroke="white" stroke-opacity="0.8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                            </g>
                            <defs>
                                <clipPath id="clip0_3396_259">
                                    <rect width="42" height="42" fill="white"/>
                                </clipPath>
                            </defs>
                        </svg>
                    </button>
                </div>
                <div class="flex flex-row gap-[10px]">
                    <div class="p-[30px] bg-[#111111] rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} color="#878787">EMAIL</Text>
                        {#if editing.email}
                            <input type="text" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" placeholder="Enter your email" />
                        {:else}
                            <Text type="h" size={24} weight="medium">Not set</Text>
                        {/if}
                    </div>

                    <button onclick={() => { editing.email = !editing.email }} class="aspect-square flex-grow h-full p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[32px] flex items-center justify-center" aria-label="edit name">
                        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g clip-path="url(#clip0_3396_259)">
                                <path d="M26.25 8.75006L33.25 15.7501M37.0545 11.9211C37.9798 10.996 38.4996 9.74137 38.4998 8.43305C38.5 7.12473 37.9804 5.86992 37.0554 4.94468C36.1304 4.01944 34.8757 3.49955 33.5674 3.49939C32.2591 3.49923 31.0043 4.0188 30.079 4.94381L6.72351 28.3046C6.31719 28.7097 6.01671 29.2085 5.84851 29.7571L3.53676 37.3731C3.49153 37.5244 3.48811 37.6852 3.52687 37.8383C3.56563 37.9914 3.64512 38.1312 3.7569 38.2428C3.86868 38.3544 4.00859 38.4337 4.16178 38.4722C4.31498 38.5107 4.47574 38.507 4.62701 38.4616L12.2448 36.1516C12.7928 35.9849 13.2916 35.6862 13.6973 35.2818L37.0545 11.9211Z" stroke="white" stroke-opacity="0.8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                            </g>
                            <defs>
                                <clipPath id="clip0_3396_259">
                                    <rect width="42" height="42" fill="white"/>
                                </clipPath>
                            </defs>
                        </svg>
                    </button>
                </div>
                <div class="flex flex-row gap-[10px]">
                    <div class="p-[30px] bg-[#111111] rounded-[32px] w-full flex flex-col justify-center">
                        <Text type="hd" size={16} color="#878787">BIRTHDAY</Text>
                        {#if editing.birthday}
                            <input type="date" class="w-full bg-transparent border-b border-[#333333] mt-[10px] pb-[5px] text-white focus:outline-none" />
                        {:else}
                            <Text type="h" size={24} weight="medium">April 30th, 2009</Text>
                        {/if}
                    </div>

                    <button onclick={() => { editing.birthday = !editing.birthday }} class="aspect-square flex-grow h-full p-[40px] bg-[#111111] hover:bg-[#202020] transition-colors duration-300 cursor-pointer rounded-[32px] flex items-center justify-center" aria-label="edit name">
                        <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g clip-path="url(#clip0_3396_259)">
                                <path d="M26.25 8.75006L33.25 15.7501M37.0545 11.9211C37.9798 10.996 38.4996 9.74137 38.4998 8.43305C38.5 7.12473 37.9804 5.86992 37.0554 4.94468C36.1304 4.01944 34.8757 3.49955 33.5674 3.49939C32.2591 3.49923 31.0043 4.0188 30.079 4.94381L6.72351 28.3046C6.31719 28.7097 6.01671 29.2085 5.84851 29.7571L3.53676 37.3731C3.49153 37.5244 3.48811 37.6852 3.52687 37.8383C3.56563 37.9914 3.64512 38.1312 3.7569 38.2428C3.86868 38.3544 4.00859 38.4337 4.16178 38.4722C4.31498 38.5107 4.47574 38.507 4.62701 38.4616L12.2448 36.1516C12.7928 35.9849 13.2916 35.6862 13.6973 35.2818L37.0545 11.9211Z" stroke="white" stroke-opacity="0.8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                            </g>
                            <defs>
                                <clipPath id="clip0_3396_259">
                                    <rect width="42" height="42" fill="white"/>
                                </clipPath>
                            </defs>
                        </svg>
                    </button>
                </div>
            </div>
        </IdentityCard>
    {/if}
</div>