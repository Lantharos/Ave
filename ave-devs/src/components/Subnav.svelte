<script lang="ts">
  interface NavItem {
    id: string;
    label: string;
    badge?: string | number;
  }

  interface Props {
    items: NavItem[];
    active: string;
    onselect: (id: string) => void;
  }

  let { items, active, onselect }: Props = $props();
</script>

<nav class="flex items-center gap-1 md:gap-2 overflow-x-auto pb-1">
  {#each items as item}
    <button
      class="group relative shrink-0 border-0 bg-transparent px-3 py-2 md:px-4 md:py-3 text-[14px] md:text-[16px] font-medium cursor-pointer transition-colors duration-300 {active === item.id ? 'text-white' : 'text-[#7a7a7a] hover:text-[#b9bbbe]'}"
      onclick={() => onselect(item.id)}
    >
      <span class="flex items-center gap-2">
        <span>{item.label}</span>
        {#if item.badge !== undefined}
          <span class="rounded-full bg-white/[0.06] px-2 py-0.5 text-[12px] text-[#a5a5a5]">{item.badge}</span>
        {/if}
      </span>
      <span class="absolute inset-x-0 bottom-0 h-px bg-white transition-opacity duration-300 {active === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-30'}"></span>
    </button>
  {/each}
</nav>
