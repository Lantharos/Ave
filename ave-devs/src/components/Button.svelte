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

  const base =
    "inline-flex items-center justify-center whitespace-nowrap font-semibold rounded-full cursor-pointer transition-all duration-200 ease-out border-0 select-none";

  const sizes: Record<string, string> = {
    sm: "px-3.5 py-1.5 text-xs",
    md: "px-5 py-2 text-sm",
  };

  const variants: Record<string, string> = {
    primary:
      "bg-white text-[#090909] hover:bg-[#e2e2e2] hover:-translate-y-px active:translate-y-0",
    ghost:
      "bg-white/[0.06] text-[#cfcfcf] hover:bg-white/[0.12] hover:text-white",
    outline:
      "bg-white/[0.02] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)]",
    danger:
      "bg-[#e14747]/10 text-[#e14747] hover:bg-[#e14747]/20",
  };
</script>

<button
  class="{base} {sizes[size]} {variants[variant]} {disabled ? 'opacity-40 pointer-events-none' : ''}"
  {disabled}
  onclick={onclick}
  {...rest}
>
  {@render children?.()}
</button>
