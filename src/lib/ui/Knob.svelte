<script lang="ts">
  // A dial with a pink pointer. Drag up/down (or left/right) to turn; arrow
  // keys work too.
  interface Props {
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    format?: (v: number) => string;
  }
  let { label, value = $bindable(), min = 0, max = 100, step = 1, format = (v) => String(Math.round(v)) }: Props = $props();

  const frac = $derived((value - min) / (max - min));
  // 270° sweep, from 7:30 to 4:30
  const angle = $derived(-135 + frac * 270);
  let startY = 0;
  let startX = 0;
  let startV = 0;
  let el: HTMLDivElement;

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));

  function down(e: PointerEvent) {
    el.setPointerCapture(e.pointerId);
    startY = e.clientY;
    startX = e.clientX;
    startV = value;
  }
  function move(e: PointerEvent) {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const d = (startY - e.clientY + (e.clientX - startX)) / 150;
    value = clamp(startV + d * (max - min));
  }
  function key(e: KeyboardEvent) {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    value = clamp(value + d * step);
  }
</script>

<div class="knob">
  <div
    bind:this={el}
    class="dial"
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
    <span class="tick" style="transform: rotate({angle}deg)"></span>
  </div>
  <span class="name">{label}</span>
  <span class="value">{format(value)}</span>
</div>

<style>
  .knob {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-width: 0;
  }
  .dial {
    width: 44px;
    height: 44px;
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--card);
    position: relative;
    cursor: ns-resize;
    touch-action: none;
  }
  .tick {
    position: absolute;
    left: calc(50% - 2px);
    top: 3px;
    width: 4px;
    height: 14px;
    box-sizing: border-box;
    background: var(--pink);
    border: 1px solid var(--ink);
    transform-origin: 2px 17px;
  }
  .name {
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .value {
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>
