<script lang="ts">
  import Button from "../components/Button.svelte";

  interface Props {
    onsignin: () => void;
    loading?: boolean;
  }

  let { onsignin, loading = false }: Props = $props();
</script>

<div class="bg-[#090909] min-h-screen flex items-center justify-center px-6">
  {#if loading}
    <div class="flex flex-col items-center gap-6">
      <div class="w-8 h-8 border-2 border-[#B9BBBE]/20 border-t-[#B9BBBE]/60 rounded-full animate-spin"></div>
    </div>
  {:else}
    <div class="flex flex-col items-center gap-10 max-w-lg text-center">
      <div class="flex flex-col items-center gap-6">
        <img src="/icon.png" alt="Ave" class="w-14 h-14 md:w-20 md:h-20" />
        <div class="flex flex-col gap-3">
          <h1 class="text-[32px] md:text-[48px] font-black m-0 tracking-tight text-white leading-tight">Developer Portal</h1>
          <p class="text-[16px] md:text-[20px] text-[#878787] m-0 leading-relaxed font-medium">
            Manage your OAuth apps, credentials, and OIDC configuration.
          </p>
        </div>
      </div>

      <Button variant="primary" onclick={onsignin}>Sign in with Ave</Button>

      <p class="text-[14px] text-[#878787] m-0">
        Don't have an account? <a href="https://aveid.net" class="text-[#B9BBBE] hover:text-white transition-colors duration-300 underline underline-offset-4">Create one at aveid.net</a>
      </p>
    </div>
  {/if}
</div>
