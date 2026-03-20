<script lang="ts">
  interface Props {
    checked?: boolean;
    label?: string;
  }

  let { checked = $bindable(false), label = "" }: Props = $props();

  function toggle() {
    checked = !checked;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  class="inline-flex items-center gap-3 border-0 bg-transparent p-0 cursor-pointer text-left text-[#878787] text-[16px] md:text-[18px] select-none group"
  onclick={toggle}
  onkeydown={handleKeydown}
>
  <span
    class="relative w-[48px] h-[28px] md:w-[52px] md:h-[30px] rounded-full transition-colors duration-300 {checked
      ? 'bg-[#B9BBBE]/40'
      : 'bg-white/[0.08]'}"
  >
    <span
      class="absolute w-[22px] h-[22px] md:w-[24px] md:h-[24px] rounded-full bg-white top-[3px] left-[3px] transition-transform duration-300 {checked
        ? 'translate-x-[20px] md:translate-x-[22px]'
        : ''}"
    ></span>
  </span>
  {#if label}
    <span class="group-hover:text-white transition-colors duration-300 {checked ? 'text-white' : ''}">{label}</span>
  {/if}
</button>
