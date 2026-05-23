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

<div class="inline-flex flex-wrap gap-1 rounded-[14px] bg-[#181818] p-1">
  {#each options as option (option.value)}
    <button
      class="min-h-9 rounded-[10px] px-3.5 text-[13px] transition-[background-color,color,scale] duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B9BBBE]/35 {value === option.value ? 'bg-[#B9BBBE] text-[#090909] font-semibold' : 'text-[#858585] hover:bg-[#222] hover:text-white'}"
      onclick={() => onchange(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>
