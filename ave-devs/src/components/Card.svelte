<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="bg-[#111111]/60 rounded-[24px] md:rounded-[36px] p-4 md:p-[30px] backdrop-blur-[20px]">
  {@render children()}
</div>
