<script lang="ts">
    import Button from "../../../components/Button.svelte";
    import { api, type Identity } from "../../../lib/api";
    import { goto } from "@mateothegreat/svelte5-router";

    let { onNext, onError } = $props<{ 
        onNext?: (data: {
            handle: string;
            identity: Identity;
            hasDevices: boolean;
            hasPasskeys: boolean;
            authOptions: PublicKeyCredentialRequestOptions | null;
            authSessionId: string | null;
        }) => void;
        onError?: (error: string) => void;
    }>();
    
    // Get return URL to preserve when going to register

    let handle = $state("");
    let isLoading = $state(false);

    async function handleContinue() {
        if (!handle.trim()) {
            onError?.("Please enter your handle or ID");
            return;
        }

        isLoading = true;
        try {
            const result = await api.login.start(handle.trim());
            onNext?.({
                handle: handle.trim(),
                identity: result.identity,
                hasDevices: result.hasDevices,
                hasPasskeys: result.hasPasskeys,
                authOptions: result.authOptions || null,
                authSessionId: result.authSessionId || null,
            });
        } catch (e: any) {
            onError?.(e.message || "Account not found");
        } finally {
            isLoading = false;
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && handle.trim()) {
            handleContinue();
        }
    }
</script>

<div class="w-full md:w-auto h-auto flex flex-col items-center z-10 px-4 md:px-0">
    <h1 class="font-black text-2xl md:text-[36px] text-[#FFFFFF]/80 text-center">WHO'S SIGNING IN</h1>
    <h2 class="font-normal text-sm md:text-[18px] text-[#878787] mt-2 md:mt-[10px] mb-6 md:mb-[40px] text-center">
        Enter your handle to continue.
    </h2>

    <div class="flex flex-col md:flex-row justify-between items-center w-full gap-6 md:gap-[40px]">
        <div class="flex flex-col gap-4 md:gap-[20px] w-full md:min-w-[400px]">
            <div class="flex flex-col p-5 md:p-[30px] bg-[#171717]/80 rounded-[32px] md:rounded-[42px]">
                <input 
                    class="px-4 md:px-[15px] py-3 md:py-[10px] bg-[#090909]/50 text-[#FFFFFF] text-base md:text-[18px] rounded-full focus:outline-none focus:ring-2 focus:ring-[#B9BBBE] focus:border-[#B9BBBE]" 
                    type="text" 
                    placeholder="Your Handle or ID"
                    bind:value={handle}
                    onkeydown={handleKeydown}
                    disabled={isLoading}
                />
            </div>

            <Button 
                text={isLoading ? "CHECKING..." : "CONTINUE"} 
                icon="/icons/chevronbk-right-38.svg" 
                onclick={handleContinue}
                disabled={!handle.trim() || isLoading}
            />
            
            <div class="text-center mt-2 md:mt-4">
                <span class="text-[#878787] text-sm">Don't have an account? </span>
                <button 
                    class="text-white hover:text-[#B9BBBE] underline text-sm transition-colors"
                    onclick={() => goto("/register")}
                >
                    Create an ID
                </button>
            </div>
        </div>

        <div class="hidden md:flex flex-col p-[25px] bg-[#171717]/80 rounded-[42px]">
            <div class="w-[200px] h-[200px] bg-[#222] rounded-[20px] flex items-center justify-center">
                <span class="text-[#555] text-sm">QR Login Coming Soon</span>
            </div>
        </div>
    </div>
</div>
