<script lang="ts">
  let { authorizing, onauthorize }: { authorizing: boolean; onauthorize: () => Promise<void> } = $props();

  let position = $state(0);
  let active = $state(false);
  let submitting = $state(false);
  let pointerId: number | null = null;
  let track = $state<HTMLElement | null>(null);
  let handle = $state<HTMLElement | null>(null);
  let maxTravel = $state(0);

  const busy = $derived(authorizing || submitting);

  function measure() {
    if (!track || !handle) return;
    const inset = handle.offsetLeft;
    maxTravel = Math.max(0, track.clientWidth - handle.offsetWidth - inset * 2);
  }

  $effect(() => {
    if (!track) return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    measure();
    return () => observer.disconnect();
  });

  async function submit() {
    if (busy) return;
    submitting = true;
    position = 1;
    try {
      await onauthorize();
    } finally {
      submitting = false;
      position = 0;
    }
  }

  function start(event: PointerEvent) {
    if (busy || !handle) return;
    const bounds = handle.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    event.preventDefault();
    active = true;
    pointerId = event.pointerId;
    measure();
    try {
      track?.setPointerCapture(event.pointerId);
    } catch {
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", end);
      document.addEventListener("pointercancel", end);
    }
  }

  function move(event: PointerEvent) {
    if (!active || (pointerId !== null && event.pointerId !== pointerId) || !track || maxTravel <= 0) return;
    event.preventDefault();
    const bounds = track.getBoundingClientRect();
    const visualScale = bounds.width / track.offsetWidth || 1;
    const buttonWidth = handle?.offsetWidth || 60;
    const inset = handle?.offsetLeft || 6;
    const logicalX = (event.clientX - bounds.left) / visualScale;
    position = Math.max(0, Math.min(1, (logicalX - inset - buttonWidth / 2) / maxTravel));
    if (position >= 0.95) {
      cleanup();
      void submit();
    }
  }

  function end(event: PointerEvent) {
    if (!active || (pointerId !== null && event.pointerId !== pointerId)) return;
    cleanup();
    if (position < 0.95) position = 0;
  }

  function cleanup() {
    active = false;
    if (track && pointerId !== null) {
      try { track.releasePointerCapture(pointerId); } catch { }
    }
    pointerId = null;
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", end);
  }

  function keydown(event: KeyboardEvent) {
    if (busy) return;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") position = Math.min(1, position + 0.1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") position = Math.max(0, position - 0.1);
    else if (event.key === "Home") position = 0;
    else if (event.key === "End") position = 1;
    else if ((event.key === "Enter" || event.key === " ") && position >= 0.95) void submit();
    else return;
    event.preventDefault();
  }
</script>

<div class="flex flex-col gap-3 md:gap-[14px] mt-4 md:mt-0">
  <div
    bind:this={track}
    class="auth-slider rounded-full w-full relative h-[50px] md:h-[72px] touch-none select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-white/40 {active ? 'is-sliding' : ''} {busy ? 'is-success' : ''}"
    role="slider"
    tabindex="0"
    aria-label="Slide to sign in"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(position * 100)}
    aria-valuetext={busy ? "Signing in" : position >= 0.95 ? "Ready to sign in" : `${Math.round(position * 100)} percent`}
    aria-busy={busy}
    onpointerdown={start}
    onpointermove={move}
    onpointerup={end}
    onpointercancel={end}
    onkeydown={keydown}
  >
    <div class="auth-slider-progress absolute inset-0 pointer-events-none" style:transform={`scaleX(${position})`}></div>
    <div
      bind:this={handle}
      class="auth-slider-handle w-[40px] h-[40px] md:w-[60px] md:h-[60px] bg-white rounded-full cursor-grab flex items-center justify-center absolute top-[5px] left-[5px] md:top-[6px] md:left-[6px] z-10 {active ? '' : 'transition-[transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]'}"
      style:transform={`translateX(${maxTravel > 0 ? position * maxTravel : position * 100}px)`}
    >
      {#if busy}
        <div class="w-5 h-5 md:w-[24px] md:h-[24px] border-2 border-[#090909] border-t-transparent rounded-full animate-spin"></div>
      {:else}
        <svg class="w-5 h-5 md:w-[28px] md:h-[28px]" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M7 6L15 14L7 22M13 6L21 14L13 22" stroke="#090909" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      {/if}
    </div>
    <p
      class="text-[#A0A0A0] text-sm md:text-[16px] font-poppins font-medium absolute inset-0 text-center flex items-center justify-center pointer-events-none transition-all duration-200"
      style:opacity={busy ? 1 : Math.max(0.18, 1 - position * 1.25)}
      style:transform={`translateX(${position * 10}px)`}
    >
      {busy ? "Signing in…" : position > 0.72 ? "Keep going" : "Slide to sign in"}
    </p>
  </div>
</div>

<style>
  .auth-slider {
    background: linear-gradient(180deg, #1b1b1b 0%, #151515 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04), inset 0 0 0 1px rgba(255, 255, 255, 0.025);
  }
  .auth-slider.is-sliding, .auth-slider.is-sliding .auth-slider-handle { cursor: grabbing; }
  .auth-slider-progress {
    transform-origin: left center;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.035));
    transition: opacity 180ms ease;
  }
  .auth-slider-handle { box-shadow: 0 6px 20px rgba(0, 0, 0, 0.32), 0 0 0 3px rgba(255, 255, 255, 0.09); }
  .auth-slider.is-success .auth-slider-progress { background: linear-gradient(90deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.08)); }
  @media (prefers-reduced-motion: reduce) {
    .auth-slider *, .auth-slider-progress { transition-duration: 0.01ms !important; }
  }
</style>
