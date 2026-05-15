<script lang="ts">
  interface Props {
    value: string;
    placeholder?: string;
    type?: string;
  }

  let { value = $bindable(), placeholder = "", type = "text", ...rest }: Props = $props();
</script>

<input
  bind:value
  {placeholder}
  {type}
  class="min-h-11 w-full rounded-full bg-white/[0.04] px-5 text-[14px] text-white outline-none transition-colors duration-300 placeholder:text-[#555] focus:bg-white/[0.07]"
  {...rest}
/>
