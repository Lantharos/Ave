<script lang="ts">
  import Button from "../components/Button.svelte";

  interface Props {
    appName: string;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let { appName, onconfirm, oncancel }: Props = $props();
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
  role="dialog"
  aria-modal="true"
>
  <div
    class="bg-[#0f0f0f] border border-white/[0.08] rounded-[22px] p-6 max-w-[420px] w-[calc(100%-32px)] flex flex-col gap-4 shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
  >
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-full bg-[#e14747]/10 flex items-center justify-center shrink-0">
        <svg class="w-5 h-5 text-[#e14747]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </div>
      <div>
        <h3 class="text-base font-semibold m-0">Delete {appName}?</h3>
        <p class="text-[13px] text-[#888] m-0 mt-1">This will permanently delete the app and all its credentials.</p>
      </div>
    </div>
    <div class="flex justify-end gap-3 pt-2">
      <Button variant="ghost" onclick={oncancel}>Cancel</Button>
      <Button variant="danger" onclick={onconfirm}>Delete app</Button>
    </div>
  </div>
</div>
