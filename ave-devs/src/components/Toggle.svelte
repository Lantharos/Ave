<script lang="ts">
  interface Props {
    checked?: boolean;
    label?: string;
  }

  let { checked = $bindable(false), label = "" }: Props = $props();
</script>

<label class="inline-flex items-center gap-2.5 cursor-pointer text-[#cfcfcf] text-[13px] select-none group">
  <input type="checkbox" class="hidden" bind:checked />
  <span
    class="relative w-[42px] h-6 rounded-full transition-colors duration-200 {checked
      ? 'bg-white/30'
      : 'bg-white/[0.08]'}"
  >
    <span
      class="absolute w-[18px] h-[18px] rounded-full bg-white top-[3px] left-[3px] transition-transform duration-200 {checked
        ? 'translate-x-[18px]'
        : ''}"
    ></span>
  </span>
  {#if label}
    <span class="group-hover:text-white transition-colors duration-200">{label}</span>
  {/if}
</label>
