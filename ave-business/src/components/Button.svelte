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
    sm: "min-h-10 px-4 text-[13px]",
    md: "min-h-11 px-5 text-[14px]",
  };

  const variants = {
    primary: "bg-[#B9BBBE] text-[#090909] font-black hover:bg-[#A1A1A1]",
    ghost: "bg-white/[0.04] text-[#9a9a9a] hover:bg-white/[0.07] hover:text-white",
    danger: "bg-[#E14747]/10 text-[#E14747] hover:bg-[#E14747]/20",
  };
</script>

<button
  class="inline-flex items-center justify-center rounded-full transition-[background-color,color,scale] duration-300 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 {sizes[size]} {variants[variant]}"
  {disabled}
  onclick={onclick}
  {...rest}
>
  {@render children?.()}
</button>
