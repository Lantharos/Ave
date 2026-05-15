<script lang="ts">
  import AuroraBackdrop from "./AuroraBackdrop.svelte";
  import Button from "./Button.svelte";
  import Panel from "./Panel.svelte";

  let { onclick }: { onclick: () => void } = $props();
</script>

<main class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090909] px-4">
  <AuroraBackdrop preset="business-login" mobileHeight={360} cclass="absolute bottom-0 left-0 w-full pointer-events-none select-none" />

  <Panel class="relative z-10 w-full max-w-[520px]">
    <div class="flex flex-col gap-5">
      <h1 class="m-0 text-[34px] font-black text-white">Ave Business</h1>
      <p class="m-0 text-[15px] leading-7 text-[#858585]">Sign in with Ave to manage organization identities, keys, and SSO setup.</p>
      <Button {onclick}>Sign in with Ave</Button>
    </div>
  </Panel>
</main>
