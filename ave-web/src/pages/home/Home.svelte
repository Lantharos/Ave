<script lang="ts">
    import Text from "../../components/Text.svelte";
    import { goto, route } from "@mateothegreat/svelte5-router";
</script>

<div class="bg-[#090909] w-full h-screen-fixed flex flex-col items-start px-[200px] py-[100px] gap-[100px] relative">
    <div class="flex flex-row w-full justify-between items-start">
        <div class="flex flex-row">
            <button class="px-[40px] py-[20px] bg-[#171717] rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                about
            </button>
            <a href="/login" use:route class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                login
            </a>
            <a href="/register" use:route class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                new id
            </a>
            <button class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                asterisk
            </button>
            <a href="/faq" use:route class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                faq
            </a>
        </div>

        <div class="flex flex-col items-end justify-end">
            <a href="/privacy" use:route class="cursor-pointer hover:text-[#FFFFFF] hover:underline transition-all duration-300 rounded-full flex items-center justify-center text-[#A5A7AA] text-[24px]">
                privacy policy
            </a>
            <a href="/terms" use:route class="cursor-pointer hover:text-[#FFFFFF] hover:underline transition-all duration-300 rounded-full flex items-center justify-center text-[#A5A7AA] text-[24px]">
                terms of service
            </a>
        </div>
    </div>

    <div class="flex flex-col w-full items-start justify-center gap-[10px] z-10">
        <Text type={"h"} size={96} weight={"bold"}>
            Meet Ave.
        </Text>

        <Text type={"h"} size={36} weight={"medium"}>
            Not another login. Not another password. Just <span class="italic underline">you</span>.
        </Text>

        <Text type={"p"} size={36} weight={"normal"} cclass="mt-[10%] max-w-[80%]">
            No tracking, no profiles, no middlemen. Just a clean, secure way to prove who you are and connect safely anywhere.
        </Text>
    </div>

    <img src="/grads/home_grad.png" class="absolute bottom-0 left-0 w-full h-auto pointer-events-none select-none" alt="gradient"/>
</div>
