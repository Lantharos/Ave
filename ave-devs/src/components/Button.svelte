<script lang="ts">
  export let variant: "primary" | "ghost" | "outline" = "primary";
  export let disabled = false;
</script>

<button class={`btn btn--${variant}`} {disabled} on:click>
  <slot />
</button>

<style>
  .btn {
    border: 0;
    border-radius: 999px;
    padding: 8px 16px;
    font-size: 14px;
    line-height: 1.2;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease;
    background: transparent;
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .btn--primary {
    background: #ffffff;
    color: #090909;
  }

  .btn--primary:hover {
    background: #e9e9e9;
    transform: translateY(-1px);
  }

  .btn--ghost {
    background: rgba(255, 255, 255, 0.06);
    color: #cfcfcf;
  }

  .btn--ghost:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #ffffff;
  }

  .btn--outline {
    background: rgba(255, 255, 255, 0.02);
    color: #ffffff;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  }

  .btn--outline:hover {
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  }
</style>
