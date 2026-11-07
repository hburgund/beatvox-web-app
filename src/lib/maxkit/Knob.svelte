<script lang="ts">
  // A Max-style dial. Drag up/down (or left/right) to turn; arrows work too.
  interface Props {
    label: string;
    value: number;
    min?: number;
    max?: number;
    size?: number;
    format?: (v: number) => string;
  }
  let { label, value = $bindable(), min = 0, max = 100, size = 46, format = (v) => String(Math.round(v)) }: Props = $props();

  const frac = $derived((value - min) / (max - min));
  // 270° sweep, from 7:30 to 4:30
  const angle = $derived(-135 + frac * 270);
  let startY = 0;
  let startX = 0;
  let startV = 0;
  let el: HTMLDivElement;

  function down(e: PointerEvent) {
    el.setPointerCapture(e.pointerId);
    startY = e.clientY;
    startX = e.clientX;
    startV = value;
  }
  function move(e: PointerEvent) {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const d = (startY - e.clientY + (e.clientX - startX)) / 150;
    value = Math.round(Math.min(max, Math.max(min, startV + d * (max - min))));
  }
  function key(e: KeyboardEvent) {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    value = Math.min(max, Math.max(min, value + d));
  }
</script>

<div class="knob">
  <span class="label">{label}</span>
  <div
    bind:this={el}
    class="dial"
    style="width:{size}px;height:{size}px"
    role="slider"
    tabindex="0"
    aria-label={label}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    onpointerdown={down}
    onpointermove={move}
    onkeydown={key}
  >
    <svg viewBox="-50 -50 100 100" aria-hidden="true">
      <path d="M -32 32 A 45 45 0 1 1 32 32" fill="none" stroke="#999" stroke-width="5" />
      <path
        d="M -32 32 A 45 45 0 {frac > 2 / 3 ? 1 : 0} 1 {45 * Math.sin((angle * Math.PI) / 180)} {-45 * Math.cos((angle * Math.PI) / 180)}"
        fill="none"
        stroke="#2233dd"
        stroke-width="5"
        opacity={frac > 0.005 ? 1 : 0}
      />
      <circle r="34" fill="#fff" stroke="#666" stroke-width="2" />
      <line x1="0" y1="0" x2="0" y2="-30" stroke="#111" stroke-width="5" stroke-linecap="round" transform="rotate({angle})" />
    </svg>
  </div>
  <span class="numbox">{format(value)}</span>
</div>

<style>
  .knob {
    display: grid;
    justify-items: center;
    gap: 4px;
  }
  .label {
    font: bold 11px Arial, sans-serif;
    text-transform: uppercase;
  }
  .dial {
    touch-action: none;
    cursor: ns-resize;
  }
  .dial:focus-visible {
    outline: 2px solid var(--bv-blue);
    border-radius: 50%;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
