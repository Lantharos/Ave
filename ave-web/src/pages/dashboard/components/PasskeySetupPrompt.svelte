<script lang="ts">
    import { queryClient } from "../../../lib/query-client";
    import { queryKeys, type SecuritySnapshot } from "../../../lib/queries";
    import { clearPendingPasskeySetupPrompt, type PendingPasskeySetupPrompt } from "../../../lib/passkey-setup-prompt";
    import { PasskeySetupUnavailableError, setUpPasskeyForCurrentDevice } from "../../../lib/passkey-setup";

    let { prompt, onClose } = $props<{
        prompt: PendingPasskeySetupPrompt;
        onClose: () => void;
    }>();

    let busy = $state(false);
    let complete = $state(false);
    let error = $state<string | null>(null);

    function closePrompt() {
        clearPendingPasskeySetupPrompt();
        onClose();
    }

    function messageForError(err: unknown): string {
        if (err instanceof PasskeySetupUnavailableError) {
            return "This device can't create a passkey right now.";
        }

        if (err instanceof Error && err.name === "NotAllowedError") {
            return "Passkey setup was cancelled.";
        }

        return err instanceof Error ? err.message : "Failed to set up passkey.";
    }

    async function handleSetup() {
        if (busy) return;

        busy = true;
        error = null;

        try {
            const result = await setUpPasskeyForCurrentDevice();
            queryClient.setQueryData<SecuritySnapshot>(queryKeys.security, (previous) => {
                if (!previous) return previous;
                return {
                    ...previous,
                    passkeys: [...previous.passkeys, result.passkey],
                };
            });
            clearPendingPasskeySetupPrompt();
            complete = true;
        } catch (err) {
            error = messageForError(err);
        } finally {
            busy = false;
        }
    }
</script>

<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
    <div class="w-full max-w-[540px] rounded-[28px] bg-[#171717] p-5 shadow-[0_32px_90px_rgba(0,0,0,0.55)] md:rounded-[36px] md:p-8">
        {#if complete}
            <div class="flex flex-col gap-6">
                <div class="flex items-center gap-4">
                    <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
                        <img src="/icons/passkey-32-bk.svg" alt="" class="h-7 w-7" />
                    </div>
                    <div class="min-w-0">
                        <h2 class="m-0 text-[24px] font-black text-white md:text-[30px]">Passkey added</h2>
                        <p class="m-0 mt-1 text-[14px] leading-6 text-[#878787] md:text-[16px]">
                            This device is ready for faster sign-in next time.
                        </p>
                    </div>
                </div>

                <button
                    class="w-full rounded-full bg-[#B9BBBE] px-5 py-3.5 text-[15px] font-black text-[#090909] transition-colors hover:bg-[#A1A1A1] md:text-[17px]"
                    onclick={closePrompt}
                >
                    Continue
                </button>
            </div>
        {:else}
            <div class="flex flex-col gap-6">
                <div class="flex items-start gap-4">
                    <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
                        <img src="/icons/passkey-32-bk.svg" alt="" class="h-7 w-7" />
                    </div>
                    <div class="min-w-0">
                        <h2 class="m-0 text-[24px] font-black text-white md:text-[30px]">Set up a passkey here</h2>
                        <p class="m-0 mt-2 text-[14px] leading-6 text-[#878787] md:text-[16px]">
                            Next time on {prompt.deviceName}, sign in with device unlock instead of another device or a recovery code.
                        </p>
                    </div>
                </div>

                {#if error}
                    <div class="rounded-[18px] bg-[#E14747]/15 px-4 py-3">
                        <p class="m-0 text-[14px] text-[#E14747] md:text-[15px]">{error}</p>
                    </div>
                {/if}

                <div class="flex flex-col gap-2 md:flex-row">
                    <button
                        class="flex-1 rounded-full bg-[#222222] px-5 py-3.5 text-[15px] font-semibold text-[#D3D3D3] transition-colors hover:bg-[#2b2b2b] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 md:text-[16px]"
                        onclick={closePrompt}
                        disabled={busy}
                    >
                        Skip for now
                    </button>
                    <button
                        class="flex flex-1 items-center justify-center gap-3 rounded-full bg-[#B9BBBE] px-5 py-3.5 text-[15px] font-black text-[#090909] transition-colors hover:bg-[#A1A1A1] disabled:cursor-not-allowed disabled:opacity-50 md:text-[16px]"
                        onclick={handleSetup}
                        disabled={busy}
                    >
                        {#if busy}
                            <span class="h-4 w-4 rounded-full border-2 border-[#090909] border-t-transparent animate-spin"></span>
                        {/if}
                        {busy ? "Setting up..." : "Set up passkey"}
                    </button>
                </div>
            </div>
        {/if}
    </div>
</div>
