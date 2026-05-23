<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    variant?: "primary" | "ghost" | "outline" | "danger";
    disabled?: boolean;
    onclick?: () => void;
    size?: "sm" | "md";
    children?: Snippet;
  }

  let { variant = "primary", disabled = false, onclick, size = "md", children, ...rest }: Props = $props();

  const sizes: Record<string, string> = {
    sm: "px-5 py-2.5 text-[14px] md:px-[25px] md:py-[12px] md:text-[16px]",
    md: "px-6 py-3 text-[15px] md:px-[30px] md:py-[15px] md:text-[18px]",
  };

  const variants: Record<string, string> = {
    primary:
      "bg-[#B9BBBE] text-[#090909] font-black hover:bg-[#A1A1A1]",
    ghost:
      "bg-transparent text-[#878787] hover:bg-[#202020] hover:text-[#A8A8A8] font-medium",
    outline:
      "bg-transparent text-[#878787] font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] hover:text-white",
    danger:
      "bg-[#E14747]/10 text-[#E14747] font-medium hover:bg-[#E14747]/20",
  };
</script>

<button
  class="inline-flex items-center justify-center whitespace-nowrap rounded-full cursor-pointer transition-colors duration-300 border-0 select-none {sizes[size]} {variants[variant]} {disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}"
  {disabled}
  onclick={onclick}
  {...rest}
>
  {@render children?.()}
</button>
