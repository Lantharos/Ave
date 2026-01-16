<script lang="ts">
  export let checked = false;
  export let label = "";
</script>

<label class="toggle">
  <input type="checkbox" bind:checked />
  <span class="pill"></span>
  <span class="text">{label}</span>
</label>

<style>
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    color: #cfcfcf;
    font-size: 13px;
  }

  input {
    display: none;
  }

  .pill {
    width: 42px;
    height: 24px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    position: relative;
    transition: background 0.2s ease;
  }

  .pill::after {
    content: "";
    position: absolute;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ffffff;
    top: 3px;
    left: 3px;
    transition: transform 0.2s ease;
  }

  input:checked + .pill {
    background: rgba(255, 255, 255, 0.3);
  }

  input:checked + .pill::after {
    transform: translateX(18px);
  }
</style>
