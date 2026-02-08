<script lang="ts">
  import Button from "../components/Button.svelte";

  interface Props {
    secret: string;
    ondismiss: () => void;
  }

  let { secret, ondismiss }: Props = $props();
  let copied = $state(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(secret);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<div class="relative overflow-hidden rounded-[18px] border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.08] to-amber-600/[0.04] p-5">
  <div class="flex items-start justify-between gap-4 flex-wrap">
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1.5">
        <svg class="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <h3 class="text-sm font-semibold text-amber-200 m-0">New client secret</h3>
      </div>
      <p class="text-xs text-[#999] m-0 mb-3">Copy this secret now. You will not see it again.</p>
      <code class="block bg-black/40 rounded-lg px-3.5 py-2.5 text-[12px] text-amber-100/90 font-mono break-all select-all">{secret}</code>
    </div>
    <div class="flex gap-2 shrink-0">
      <Button variant="outline" size="sm" onclick={handleCopy}>
        {copied ? "Copied" : "Copy"}
      </Button>
      <Button variant="ghost" size="sm" onclick={ondismiss}>Dismiss</Button>
    </div>
  </div>
</div>
