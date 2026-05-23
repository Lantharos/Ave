<script lang="ts">
  import Button from "../components/Button.svelte";

  interface Props {
    appName: string;
    onconfirm: () => void;
    oncancel: () => void;
    deleting: boolean;
  }

  let { appName, onconfirm, oncancel, deleting }: Props = $props();
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
  role="dialog"
  aria-modal="true"
>
  <div
    class="bg-[#171717] rounded-[24px] md:rounded-[36px] p-6 md:p-10 max-w-[480px] w-[calc(100%-32px)] flex flex-col gap-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
  >
    <div class="flex flex-col gap-3">
      <h3 class="text-[20px] md:text-[24px] font-black m-0 text-white">Delete {appName}?</h3>
      <p class="text-[14px] md:text-[16px] text-[#878787] m-0 font-medium">This will permanently delete the app and all its credentials.</p>
    </div>
    <div class="flex justify-end gap-3 pt-2">
      <Button variant="ghost" onclick={oncancel} disabled={deleting}>Cancel</Button>
      <Button variant="danger" onclick={onconfirm} disabled={deleting}>{deleting ? "Deleting..." : "Delete app"}</Button>
    </div>
  </div>
</div>
