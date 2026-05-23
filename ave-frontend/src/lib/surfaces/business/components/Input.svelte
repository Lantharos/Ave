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
  class="min-h-11 w-full rounded-[14px] bg-[#181818] px-4 text-[14px] text-white outline-none transition-[background-color,box-shadow] duration-200 placeholder:text-[#5f5f5f] focus:bg-[#202020] focus:shadow-[0_0_0_2px_rgba(185,187,190,0.18)]"
  {...rest}
/>
