<script lang="ts">
    import IdentityCard from "../../components/IdentityCard.svelte";
    import Text from "../../components/Text.svelte";


</script>

<div class="bg-[#090909] h-screen flex items-center gap-[50px] p-[50px]">
    <div class="flex-1 z-10 flex flex-col items-start justify-between h-full p-[50px]">
        <div class="flex flex-row gap-[20px] items-start">
            <img src="/icon.png" alt="Ave Logo" class="w-[80px] h-[80px]"/>
            <div class="flex flex-col gap-[10px]">
                <h1 class="font-poppins text-[48px] text-white">
                    Ave
                </h1>
                <h2 class="font-poppins text-[32px] text-[#878787]">
                    by Lantharos
                </h2>
            </div>
        </div>

        <div class="flex flex-col gap-[20px]">
            <h2 class="font-poppins text-[32px] text-[#878787]">
                You’re signing in securely through Ave.
            </h2>

            <!-- Place for additional authorization details, like E2EE -->
            <div class="flex flex-col gap-[10px]">
                <!-- Example E2ee -->
                <div class="p-[30px] bg-[#171717]/80 flex flex-col gap-[10px] border-[2px] border-[#32A94C] rounded-[32px]">
                    <h3 class="font-poppins flex flex-row gap-[10px] text-[24px] text-[#32A94C] items-center">
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10.5 15V10.5C10.5 8.51088 11.2902 6.60322 12.6967 5.1967C14.1032 3.79018 16.0109 3 18 3C19.9891 3 21.8968 3.79018 23.3033 5.1967C24.7098 6.60322 25.5 8.51088 25.5 10.5V15M19.5 24C19.5 24.8284 18.8284 25.5 18 25.5C17.1716 25.5 16.5 24.8284 16.5 24C16.5 23.1716 17.1716 22.5 18 22.5C18.8284 22.5 19.5 23.1716 19.5 24ZM7.5 15H28.5C30.1569 15 31.5 16.3431 31.5 18V30C31.5 31.6569 30.1569 33 28.5 33H7.5C5.84315 33 4.5 31.6569 4.5 30V18C4.5 16.3431 5.84315 15 7.5 15Z" stroke="#32A94C" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        End-to-End Encrypted
                    </h3>
                    <p class="font-poppins text-[22px] text-[#878787]">
                        This app requests encryption keys from Ave each time you log in, ensuring your data stays end-to-end encrypted.                   
                    </p>
                </div>
            </div>
        </div>
    </div>

    <div class="flex-1 h-full px-[75px] z-10 py-[70px] flex flex-col justify-between rounded-[64px] bg-[#111111]/60 backdrop-blur-xl">
        <div class="flex flex-col gap-[40px]">
            <div class="flex flex-row gap-[20px]">
                <h1 class="text-white text-[48px] font-bold font-poppins">Signing in as</h1>

                <!-- Dropdown for identity selection -->
                 <div class="bg-[#171717] p-[10px] items-center rounded-full flex flex-row gap-[15px] hover:bg-[#242424] cursor-pointer transition-colors duration-300">
                    <img src="/placeholder.png" alt="User Avatar" class="w-[50px] h-[50px] rounded-full"/>
                    <span class="text-white text-[24px] font-poppins font-semibold">
                        Niko
                    </span>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 9L12 15L18 9" stroke="#C7C7C7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                 </div>
            </div>

            <IdentityCard avatar="/placeholder.png" banner="" bannerColor="#FFFFFF" editable={false}>
                <div class="flex flex-col gap-[10px]">
                    <div class="flex flex-row gap-[10px] w-full flex-1">
                        <div class="p-[30px] bg-[#111111] rounded-[32px] flex-1">
                            <Text type="hd" size={16} color="#878787">NAME</Text>
                            <Text type="h" size={26} color="#FFFFFF">Niko Arden</Text>
                        </div>
                        <div class="p-[30px] bg-[#111111] rounded-[32px] flex-1">
                            <Text type="hd" size={16} color="#878787">HANDLE</Text>
                            <Text type="h" size={26} color="#FFFFFF">nikoarden</Text>
                        </div>
                    </div>
                    <div class="p-[30px] bg-[#111111] rounded-[32px]">
                        <Text type="hd" size={16} color="#878787">EMAIL</Text>
                        <Text type="h" size={26} color="#FFFFFF">arden@lanth.me</Text>
                    </div>
                </div>
            </IdentityCard>
        </div>

        <!-- Swipe to authorize -->
        <div class="rounded-full bg-[#171717]/80 border-[6px] border-[#171717]/80 w-full relative">
            <button class="w-[70px] h-[70px] bg-white rounded-full cursor-grab flex items-center justify-center" aria-label="Drag to authorize">
                <svg width="35" height="35" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 30L23 18L11 6" stroke="#090909" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>

            <p class="text-[#878787] text-[18px] font-poppins font-normal absolute top-0 bottom-0 left-0 right-0 text-center py-[20px]">
                Swipe to Authorize
            </p>
        </div>
    </div>

    <div class="absolute bottom-0 right-0">
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