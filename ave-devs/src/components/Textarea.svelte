<script lang="ts">
  export let value = "";
  export let rows = 4;
  export let placeholder = "";
</script>

<textarea class="textarea" bind:value {rows} {placeholder}></textarea>

<style>
  .textarea {
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 0;
    border-radius: 14px;
    padding: 12px 14px;
    color: #ffffff;
    font-family: inherit;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    resize: vertical;
  }

  .textarea:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
  }
</style>
