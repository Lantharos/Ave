<script lang="ts">
  export let value: string | number = "";
  export let placeholder = "";
  export let type = "text";
</script>

<input class="input" bind:value {placeholder} {type} />

<style>
  .input {
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 0;
    border-radius: 14px;
    padding: 12px 14px;
    color: #ffffff;
    font-family: inherit;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  .input:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
  }
</style>
