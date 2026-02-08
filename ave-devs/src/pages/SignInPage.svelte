<script lang="ts">
  import Button from "../components/Button.svelte";

  interface Props {
    onsignin: () => void;
    error?: string;
  }

  let { onsignin, error = "" }: Props = $props();
</script>

<div class="flex items-center justify-center min-h-[calc(100vh-80px)]">
  <div class="flex flex-col items-center gap-8 max-w-md text-center px-6">
    <div class="flex flex-col items-center gap-5">
      <div class="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
        <img src="/icon.png" alt="Ave" class="w-8 h-8" />
      </div>
      <div>
        <h1 class="text-[clamp(24px,3vw,32px)] font-bold m-0 mb-2 tracking-tight">Ave Developer Portal</h1>
        <p class="text-[15px] text-[#888] m-0 leading-relaxed max-w-sm mx-auto">
          Sign in to manage your OAuth apps, credentials, and OIDC configuration.
        </p>
      </div>
    </div>

    {#if error}
      <div class="w-full bg-[#e14747]/10 border border-[#e14747]/20 rounded-2xl px-4 py-3 text-[13px] text-[#e14747]">
        {error}
      </div>
    {/if}

    <Button variant="primary" onclick={onsignin}>Sign in with Ave</Button>

    <p class="text-[12px] text-[#555] m-0">
      Don't have an account? <a href="https://aveid.net" class="text-[#999] hover:text-white transition-colors underline underline-offset-2">Create one at aveid.net</a>
    </p>
  </div>
</div>
