<script lang="ts">
  interface Props {
    value?: string;
    rows?: number;
    placeholder?: string;
  }

  let { value = $bindable(""), rows = 4, placeholder = "" }: Props = $props();
</script>

<textarea
  class="w-full bg-white/[0.04] border-0 rounded-[14px] px-4 py-3 text-white text-sm font-[inherit] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] placeholder:text-[#555] outline-none focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] transition-shadow duration-200 resize-y"
  bind:value
  {rows}
  {placeholder}
></textarea>
