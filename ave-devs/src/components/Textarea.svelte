<script lang="ts">
  interface Props {
    value?: string;
    rows?: number;
    placeholder?: string;
  }

  let { value = $bindable(""), rows = 4, placeholder = "" }: Props = $props();
</script>

<textarea
  class="w-full bg-[#090909]/50 border-0 rounded-[24px] px-5 py-3.5 md:px-6 md:py-4 text-white text-[15px] md:text-[16px] font-[inherit] placeholder:text-[#555] outline-none focus:ring-2 focus:ring-[#B9BBBE] transition-all duration-300 resize-y"
  bind:value
  {rows}
  {placeholder}
></textarea>
