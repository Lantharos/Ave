<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
    class?: string;
  }

  let { children, class: className = "" }: Props = $props();
</script>

<div class={`bg-[#111111]/60 rounded-[24px] md:rounded-[36px] p-4 md:p-[30px] backdrop-blur-[20px] ${className}`}>
  {@render children()}
</div>
