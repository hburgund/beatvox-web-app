<script lang="ts">
  // The v1.93 ring button: a colored ring on a grey tile.
  interface Props {
    label: string;
    color: 'green' | 'red' | 'blue';
    size?: number;
    /** text inside the ring; defaults to the label */
    inner?: string;
    disabled?: boolean;
    pressed?: boolean;
    onclick: () => void;
  }
  let { label, color, size = 46, inner, disabled = false, pressed = false, onclick }: Props = $props();
</script>

<button
  class="tile {color}"
  class:pressed
  style="--s:{size}px"
  aria-label={label}
  {disabled}
  {onclick}
>
  <span class="ring">{inner ?? label}</span>
</button>

<style>
  .tile {
    width: calc(var(--s) + 18px);
    height: calc(var(--s) + 18px);
    display: grid;
    place-items: center;
    background: var(--bv-tile);
    border: none;
    border-radius: 4px;
    padding: 0;
    cursor: pointer;
    flex: none;
    touch-action: manipulation;
  }
  .ring {
    width: var(--s);
    height: var(--s);
    box-sizing: border-box;
    border-radius: 50%;
    background: #fff;
    border: calc(var(--s) * 0.11) solid;
    display: grid;
    place-items: center;
    font: bold calc(var(--s) * 0.2) Arial, sans-serif;
    text-transform: uppercase;
    transition: transform 60ms;
  }
  .green .ring { border-color: var(--bv-green); }
  .red .ring { border-color: var(--bv-red); }
  .blue .ring { border-color: var(--bv-blue); }
  .tile:active .ring,
  .pressed .ring {
    transform: scale(0.93);
    background: #eef3ff;
  }
  .green.pressed .ring { background: #e3fbe3; }
  .tile:disabled { cursor: default; }
  .tile:disabled .ring { opacity: 0.4; }
  .tile:focus-visible { outline: 2px solid var(--bv-blue); outline-offset: 2px; }
</style>
