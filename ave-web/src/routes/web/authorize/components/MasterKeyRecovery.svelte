<script lang="ts">
  import Input from "$lib/surfaces/web/components/Input.svelte";
  import Text from "$lib/surfaces/web/components/Text.svelte";
  import LoginWaiting from "../../login/components/LoginWaiting.svelte";

  let {
    view = $bindable(),
    loginRequestId,
    loginRequestToken,
    ephemeralKeyPair,
    error = $bindable(),
    recoveryCode = $bindable(),
    recovering,
    mismatch,
    unlocking,
    hasTrustedDevices,
    requestingDeviceApproval,
    onRecovered,
    onUnlock,
    onDeviceApproval,
    onRecoverySubmit,
  }: {
    view: "options" | "device" | "recovery";
    loginRequestId: string | null;
    loginRequestToken: string | null;
    ephemeralKeyPair: { publicKey: string; privateKey: CryptoKey } | null;
    error: string | null;
    recoveryCode: string;
    recovering: boolean;
    mismatch: boolean;
    unlocking: boolean;
    hasTrustedDevices: boolean;
    requestingDeviceApproval: boolean;
    onRecovered: () => Promise<void>;
    onUnlock: () => Promise<void>;
    onDeviceApproval: () => Promise<void>;
    onRecoverySubmit: () => Promise<void>;
  } = $props();

  function showOptions() {
    view = "options";
    error = null;
  }
</script>

<div class="flex flex-1 flex-col items-center justify-center gap-[30px]">
  {#if view === "device" && loginRequestId}
    <LoginWaiting
      {loginRequestId}
      {loginRequestToken}
      {ephemeralKeyPair}
      masterKeyOnly
      onSuccess={onRecovered}
      onError={(message) => { error = message; view = "options"; }}
      onBack={showOptions}
    />
  {:else if view === "recovery"}
    <div class="flex w-full max-w-[350px] flex-col gap-[20px]">
      <div class="text-center">
        <Text type="h" size={24} color="#FFFFFF">Recovery code</Text>
        <p class="mt-[10px] text-[16px] text-[#878787]">Enter a one-time recovery code to restore your encryption key on this device.</p>
      </div>
      {#if error}<p class="text-center text-[14px] text-[#E14747]">{error}</p>{/if}
      <Input
        class="text-center tracking-widest"
        placeholder="Recovery code"
        bind:value={recoveryCode}
        onkeydown={(event) => { if (event.key === "Enter") void onRecoverySubmit(); }}
      />
      <button
        class="w-full rounded-[16px] bg-white py-[18px] font-semibold text-[#090909] transition-colors hover:bg-[#E0E0E0] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={recovering || !recoveryCode.trim()}
        onclick={() => void onRecoverySubmit()}
      >{recovering ? "Restoring…" : "Restore encryption key"}</button>
      <button class="w-full py-[14px] text-[#878787] transition-colors hover:text-white" onclick={showOptions}>Back</button>
    </div>
  {:else}
    <div class="flex h-[80px] w-[80px] items-center justify-center rounded-full bg-[#E14747]/20">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L4 7V12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12V7L12 2Z" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 8V12M12 16H12.01" stroke="#E14747" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="text-center">
      <Text type="h" size={24} color="#FFFFFF">Encryption Key Required</Text>
      <p class="mt-[10px] max-w-[400px] text-[16px] text-[#878787]">
        {mismatch
          ? "This app already has encryption keys saved. We couldn't read them with what's stored in this browser — restore your account encryption key to sync this device."
          : "This app uses end-to-end encryption. Your encryption key wasn't found on this device."}
      </p>
    </div>
    <div class="flex w-full max-w-[350px] flex-col gap-[15px]">
      {#if error && !mismatch}<p class="text-center text-[14px] text-[#E14747]">{error}</p>{/if}
      <button
        class="w-full rounded-[16px] bg-white py-[18px] font-semibold text-[#090909] transition-colors hover:bg-[#E0E0E0] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={unlocking}
        onclick={onUnlock}
      >{unlocking ? "Unlocking…" : "Unlock with Passkey"}</button>
      {#if hasTrustedDevices}
        <button
          class="w-full rounded-[16px] bg-[#171717] py-[18px] font-semibold text-white transition-colors hover:bg-[#222222] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={requestingDeviceApproval}
          onclick={() => void onDeviceApproval()}
        >{requestingDeviceApproval ? "Requesting…" : "Approve on another device"}</button>
      {/if}
      <button class="w-full rounded-[16px] bg-[#171717] py-[18px] font-semibold text-white transition-colors hover:bg-[#222222]" onclick={() => { view = "recovery"; error = null; }}>Use recovery code</button>
    </div>
  {/if}
</div>
