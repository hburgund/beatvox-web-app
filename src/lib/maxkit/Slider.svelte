<script lang="ts">
  // The Max slider: a white well with a thick black line for the thumb, and a
  // number box. Vertical on laptops, horizontal on phones. Tap or drag anywhere.
  interface Props {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    vertical?: boolean;
    length?: number;
    format?: (v: number) => string;
  }
  let { label, value = $bindable(), min, max, step = 1, vertical = true, length = 110, format = (v) => String(Math.round(v)) }: Props = $props();

  let well: HTMLDivElement;
  const frac = $derived((value - min) / (max - min));

  function setFrom(e: PointerEvent) {
    const r = well.getBoundingClientRect();
    let f = vertical ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
    f = Math.min(1, Math.max(0, f));
    const v = min + f * (max - min);
    value = Math.round(v / step) * step;
  }
  function down(e: PointerEvent) {
    well.setPointerCapture(e.pointerId);
    setFrom(e);
  }
  function move(e: PointerEvent) {
    if (well.hasPointerCapture(e.pointerId)) setFrom(e);
  }
  function key(e: KeyboardEvent) {
    const big = (max - min) / 10;
    const d = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: big, PageDown: -big }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    value = Math.min(max, Math.max(min, Math.round((value + d) / step) * step));
  }
</script>

<div class="slider" class:vertical>
  <span class="label">{label}</span>
  <div
    class="well"
    bind:this={well}
    style={vertical ? `height:${length}px` : ''}
    role="slider"
    tabindex="0"
    aria-label={label}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    aria-valuetext={format(value)}
    onpointerdown={down}
    onpointermove={move}
    onkeydown={key}
  >
    <div class="thumb" style={vertical ? `bottom:calc(${frac * 100}% - 2px)` : `left:calc(${frac * 100}% - 2px)`}></div>
  </div>
  <span class="numbox">{format(value)}</span>
</div>

<style>
  .slider {
    display: grid;
    grid-template-columns: 70px minmax(0, 1fr) 46px;
    align-items: center;
    gap: 8px;
  }
  .slider.vertical {
    grid-template-columns: auto;
    justify-items: center;
    gap: 5px;
  }
  .label {
    font: bold 11px Arial, sans-serif;
    text-transform: uppercase;
  }
  .well {
    position: relative;
    background: #fff;
    border: 1px solid #777;
    border-radius: 3px;
    box-shadow: inset 1px 1px 2px #bbb;
    touch-action: none;
    cursor: pointer;
    height: 26px;
  }
  .vertical .well {
    width: 22px;
  }
  .thumb {
    position: absolute;
    background: #111;
    border-radius: 1px;
    pointer-events: none;
  }
  .vertical .thumb {
    left: 2px;
    right: 2px;
    height: 3px;
  }
  .slider:not(.vertical) .thumb {
    top: 2px;
    bottom: 2px;
    width: 3px;
  }
  .well:focus-visible {
    outline: 2px solid var(--bv-blue);
    outline-offset: 2px;
  }
</style>
