<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    variant?: "primary" | "ghost" | "danger";
    size?: "sm" | "md";
    disabled?: boolean;
    onclick?: () => void;
    children?: Snippet;
  }

  let { variant = "primary", size = "md", disabled = false, onclick, children, ...rest }: Props = $props();

  const sizes = {
    sm: "min-h-10 px-3.5 text-[13px]",
    md: "min-h-11 px-4 text-[14px]",
  };

  const variants = {
    primary: "bg-[#B9BBBE] text-[#090909] font-semibold hover:bg-[#A1A1A1] focus-visible:bg-[#A1A1A1]",
    ghost: "bg-[#181818] text-[#9a9a9a] hover:bg-[#202020] hover:text-white focus-visible:bg-[#202020] focus-visible:text-white",
    danger: "bg-[#241313] text-[#E14747] hover:bg-[#301717] focus-visible:bg-[#301717]",
  };
</script>

<button
  class="inline-flex items-center justify-center rounded-[14px] transition-[background-color,color,scale] duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9BBBE]/35 {sizes[size]} {variants[variant]}"
  {disabled}
  onclick={onclick}
  {...rest}
>
  {@render children?.()}
</button>
