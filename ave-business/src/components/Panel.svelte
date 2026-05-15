<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
    class?: string;
  }

  let { children, class: className = "" }: Props = $props();
</script>

<section class="rounded-[28px] bg-[#111111]/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] md:p-6 {className}">
  {@render children()}
</section>
