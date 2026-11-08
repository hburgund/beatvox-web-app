<script lang="ts">
  // A real checkbox drawn as a ☒ box, to match the beat grid.
  import type { Snippet } from 'svelte';
  interface Props {
    checked: boolean;
    disabled?: boolean;
    children: Snippet;
  }
  let { checked = $bindable(), disabled = false, children }: Props = $props();
</script>

<label class="check" class:disabled>
  <input type="checkbox" bind:checked {disabled} />
  <span class="box" aria-hidden="true"></span>
  <span class="text">{@render children()}</span>
</label>

<style>
  .check {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 0;
    cursor: pointer;
    position: relative;
  }
  .disabled {
    opacity: 0.55;
    cursor: default;
  }
  input {
    position: absolute;
    top: 10px;
    opacity: 0;
    width: 20px;
    height: 20px;
    margin: 0;
  }
  .box {
    width: 20px;
    height: 20px;
    flex: none;
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 3px;
    background: var(--card);
    position: relative;
  }
  input:checked + .box::before,
  input:checked + .box::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 1px;
    bottom: 1px;
    width: 2px;
    background: var(--ink);
  }
  input:checked + .box::before {
    transform: translateX(-50%) rotate(45deg);
  }
  input:checked + .box::after {
    transform: translateX(-50%) rotate(-45deg);
  }
  input:focus-visible + .box {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  .text {
    line-height: 20px;
  }
</style>
