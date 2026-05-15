<script lang="ts" generics="T extends string">
  interface Option<TValue extends string> {
    value: TValue;
    label: string;
  }

  interface Props<TValue extends string> {
    value: TValue;
    options: Option<TValue>[];
    onchange: (value: TValue) => void;
  }

  let { value, options, onchange }: Props<T> = $props();
</script>

<div class="inline-flex flex-wrap gap-1 rounded-full bg-white/[0.04] p-1">
  {#each options as option (option.value)}
    <button
      class="min-h-10 rounded-full px-4 text-[13px] transition-[background-color,color,scale] duration-300 active:scale-[0.96] {value === option.value ? 'bg-[#B9BBBE] text-[#090909] font-black' : 'text-[#858585] hover:bg-white/[0.05] hover:text-white'}"
      onclick={() => onchange(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>
