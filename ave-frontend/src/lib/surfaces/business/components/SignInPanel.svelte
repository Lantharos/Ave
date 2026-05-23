<script lang="ts">
  import AuroraBackdrop from "./AuroraBackdrop.svelte";
  import Button from "./Button.svelte";
  import Panel from "./Panel.svelte";

  let { onclick }: { onclick: () => void } = $props();
</script>

<main class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090909] px-4">
  <AuroraBackdrop preset="business-login" cclass="opacity-90" mobileHeight={360} />

  <Panel class="relative z-10 w-full max-w-[480px]">
    <div class="flex flex-col gap-5">
      <div>
        <p class="m-0 text-[14px] text-[#858585]">business.aveid.net</p>
        <h1 class="m-0 mt-2 text-[32px] font-semibold leading-tight text-white">Ave Business</h1>
      </div>
      <p class="m-0 text-[15px] leading-7 text-[#858585]">Sign in with Ave to manage organization identities, keys, and SSO setup.</p>
      <Button {onclick}>Sign in with Ave</Button>
    </div>
  </Panel>
</main>
