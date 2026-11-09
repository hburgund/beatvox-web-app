<script lang="ts">
  // One row's level in the Mix view: drag (or tap) along the bar; arrow keys
  // nudge it. The fill flashes when the row plays.
  interface Props {
    label: string;
    value: number;
    /** the row is sounding right now */
    lit?: boolean;
    disabled?: boolean;
    onchange: (v: number) => void;
  }
  let { label, value, lit = false, disabled = false, onchange }: Props = $props();

  let el: HTMLDivElement;
  const pct = $derived(Math.round(value * 100));

  function at(e: PointerEvent) {
    const r = el.getBoundingClientRect();
    onchange(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  }
  function down(e: PointerEvent) {
    if (disabled) return;
    el.setPointerCapture(e.pointerId);
    at(e);
  }
  function move(e: PointerEvent) {
    if (el.hasPointerCapture(e.pointerId)) at(e);
  }
  function key(e: KeyboardEvent) {
    const d = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2, Home: -1, End: 1 }[e.key];
    if (d === undefined || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    onchange(Math.min(1, Math.max(0, value + d)));
  }
</script>

<div class="level">
  <div
    bind:this={el}
    class="bar"
    class:lit
    role="slider"
    tabindex={disabled ? -1 : 0}
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={pct}
    aria-valuetext="{pct}%"
    aria-disabled={disabled}
    onpointerdown={down}
    onpointermove={move}
    onkeydown={key}
  >
    <span class="fill" style="width:{pct}%"></span>
  </div>
  <span class="value">{pct}</span>
</div>

<style>
  .level {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .bar {
    flex: 1;
    height: 24px;
    box-sizing: border-box;
    border: 1.5px solid var(--ink);
    border-radius: 3px;
    background: var(--card);
    position: relative;
    overflow: hidden;
    cursor: ew-resize;
    touch-action: none;
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--blue);
    border-right: 3px solid var(--pink);
    box-sizing: border-box;
    transition: background 80ms;
  }
  .bar.lit .fill {
    background: #4b56e0;
  }
  .value {
    width: 26px;
    text-align: right;
    font: 700 12px var(--mono);
    font-variant-numeric: tabular-nums;
  }
</style>
