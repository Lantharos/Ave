<script lang="ts">
  export let tone: "default" | "soft" = "default";
</script>

<div class={`card card--${tone}`}>
  <slot />
</div>

<style>
  .card {
    border-radius: 22px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.04);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  }

  .card--soft {
    background: rgba(255, 255, 255, 0.02);
  }
</style>
