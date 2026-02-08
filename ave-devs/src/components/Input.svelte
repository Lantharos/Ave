<script lang="ts">
  interface Props {
    value?: string | number;
    placeholder?: string;
    type?: string;
    oninput?: (e: Event) => void;
  }

  let { value = $bindable(""), placeholder = "", type = "text", oninput }: Props = $props();
</script>

<input
  class="w-full bg-[#090909]/50 border-0 rounded-full px-5 py-3.5 md:px-6 md:py-4 text-white text-[15px] md:text-[16px] font-[inherit] placeholder:text-[#555] outline-none focus:ring-2 focus:ring-[#B9BBBE] transition-all duration-300"
  bind:value
  {placeholder}
  {type}
  {oninput}
/>
