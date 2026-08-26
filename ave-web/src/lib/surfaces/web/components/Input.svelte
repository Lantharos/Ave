<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  let {
    value = $bindable(""),
    class: className = "",
    ...attributes
  }: HTMLInputAttributes & { value?: string } = $props();
</script>

<input
  bind:value
  class="w-full rounded-[16px] border-0 bg-[#171717] px-4 py-3 text-white outline-none transition-[background-color,box-shadow] placeholder:text-[#5f5f5f] focus:bg-[#1d1d1d] focus:shadow-[0_0_0_2px_rgba(255,255,255,0.14)] {className}"
  {...attributes}
/>
