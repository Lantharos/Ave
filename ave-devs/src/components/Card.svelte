<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    tone?: "default" | "soft" | "elevated";
    children: Snippet;
  }

  let { tone = "default", children }: Props = $props();

  const tones: Record<string, string> = {
    default:
      "bg-white/[0.04] shadow-[0_4px_24px_rgba(0,0,0,0.3)]",
    soft: "bg-white/[0.02]",
    elevated:
      "bg-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
  };
</script>

<div
  class="rounded-[22px] p-5 border border-white/[0.06] {tones[tone]}"
>
  {@render children()}
</div>
