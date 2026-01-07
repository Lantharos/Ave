<script lang="ts">
    import Aq from "./components/AQ.svelte";
    import { route } from "@mateothegreat/svelte5-router";
</script>

<div class="bg-[#090909] w-full h-screen-fixed flex flex-col items-start px-[200px] py-[100px] gap-[100px] overflow-y-scroll scroll-smooth relative">
    <div class="flex flex-row w-full justify-between items-start">
        <div class="flex flex-row">
            <a href="/" use:route class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                about
            </a>
            <a href="/login" use:route class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                login
            </a>
            <a href="/register" use:route class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                new id
            </a>
            <button class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                asterisk
            </button>
            <a href="/docs" use:route class="px-[40px] py-[20px] cursor-pointer hover:bg-[#121212] transition-colors duration-300 rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                docs
            </a>
            <button class="px-[40px] py-[20px] bg-[#171717] rounded-full flex items-center justify-center text-[#B9BBBE] text-[24px]">
                faq
            </button>
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
        <Aq
            question="What exactly is Ave?"
            answer="Ave is your digital identity. It’s how you log in, prove who you are, and stay secure, without handing over your data. Think of it as a keychain that only you control."
        />
        <Aq
            question="Do I need an email or phone number?"
            answer="Nope. Ave doesn’t rely on personal identifiers like emails or phone numbers. Your ID lives on your devices, not in some giant database."
        />
        <Aq
            question="How do I sign in to an app with Ave?"
            answer="When an app supports Ave, you’ll see the option to “Sign in with Ave.” Choose your identity, approve the request, and you’re in — no passwords, no forms."
        />
        <Aq
            question="What happens if I lose my device?"
            answer="If you lose access to a device, you can restore your Ave ID using another device that’s already trusted. That trusted device will securely transfer your encryption keys and verify your identity. If you don’t have any other trusted device, you’ll need to recover access using your Trust Codes or Security Questions. These must match exactly, since Ave never stores or sees your answers—they’re hashed and used only to unlock your backup encryption keys. Because Ave never holds your private keys, we can’t restore access for you. Your security stays fully in your hands."
        />
        <Aq
            question="Does Ave track me across apps?"
            answer="Absolutely not. Ave doesn’t store or link your activity between apps. Each app only gets what it needs to function, nothing more."
        />
        <Aq
            question="Is Ave decentralized or cloud-based?"
            answer="It’s hybrid. Your identity lives locally on your devices, but Ave coordinates keys and security verification so everything stays synced and encrypted."
        />
        <Aq
            question="Can I have multiple identities?"
            answer="Yes! You can create up to 5 separate identities (for work, personal use, or just vibes) — all managed under the same secure Ave ID."
        />
    </div>

    <img src="/grads/faq_grad.png" class="absolute bottom-0 left-0 w-full h-auto pointer-events-none select-none" alt="gradient"/>
</div>
