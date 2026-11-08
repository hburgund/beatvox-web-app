<script lang="ts">
  // The 8 × 16 beat grid of ☒ boxes. Tap a box to add or remove a hit; tap a
  // slice number to rest or wake that row. The box under the playhead lights.
  import type { Voice } from '../audio/engine';

  interface Props {
    voices: Voice[];
    step: number;
    firing: number[];
    disabled?: boolean;
    /** the row a dragged slice is over */
    dropRow?: number | null;
    ontoggle: (voice: number, step: number) => void;
    ontogglevoice: (voice: number) => void;
  }
  let { voices, step, firing, disabled = false, dropRow = null, ontoggle, ontogglevoice }: Props = $props();

  // an empty grid to show before there's a voice
  const blank = Array.from({ length: 8 }, (_, i) => ({ on: true, slice: i, pattern: Array(16).fill(false) }));
  const rows = $derived(voices.length ? voices : blank);

  // arrow keys move between boxes (only one box per row is a Tab stop)
  function move(e: KeyboardEvent) {
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    const el = e.target as HTMLElement;
    const r = Number(el.dataset.r);
    const c = Number(el.dataset.c);
    if (!d || Number.isNaN(r)) return;
    e.preventDefault();
    const nr = Math.min(rows.length - 1, Math.max(0, r + d[0]));
    const nc = Math.min(15, Math.max(0, c + d[1]));
    (el.closest('.grid')?.querySelector(`[data-r="${nr}"][data-c="${nc}"]`) as HTMLElement | null)?.focus();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="grid" class:disabled role="group" aria-label="Beat: {rows.filter((v) => v.on).length} of {rows.length} slices playing" onkeydown={move}>
  {#each rows as v, i (i)}
    <div class="row" class:resting={!v.on} class:drop={dropRow === i} data-row={i}>
      <button
        class="slice"
        {disabled}
        aria-pressed={v.on}
        aria-label="Row {i + 1} plays slice {v.slice + 1}, {v.on ? 'playing' : 'resting'}"
        onclick={() => ontogglevoice(i)}>{v.slice + 1}</button
      >
      <div class="steps">
        {#each v.pattern as on, s (s)}
          <button
            class="cell"
            class:on
            class:now={s === step}
            class:fire={s === step && on && v.on && firing.includes(i)}
            class:downbeat={s % 4 === 0}
            data-r={i}
            data-c={s}
            tabindex={s === 0 ? 0 : -1}
            {disabled}
            aria-pressed={on}
            aria-label="Row {i + 1}, step {s + 1}"
            onclick={() => ontoggle(i, s)}
          ></button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    gap: 3px;
  }
  .grid.disabled {
    opacity: 0.45;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .slice {
    width: 26px;
    height: 24px;
    flex: none;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: var(--blue);
    color: #fff;
    font: 700 12px var(--mono);
    cursor: pointer;
  }
  .row.drop {
    outline: 2px dashed var(--pink);
    outline-offset: 2px;
    border-radius: 3px;
  }
  .resting .slice {
    background: transparent;
    color: var(--muted);
    text-decoration: line-through;
  }
  .steps {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(16, minmax(0, 1fr));
    column-gap: 2px;
  }
  .cell {
    height: 24px;
    padding: 0;
    border: 1.5px solid var(--soft);
    border-radius: 3px;
    background: var(--card);
    position: relative;
    cursor: pointer;
    touch-action: manipulation;
  }
  /* a little extra space before each beat */
  .cell.downbeat:not(:first-child) {
    margin-left: 4px;
  }
  .cell.downbeat {
    background: var(--paper);
  }
  .cell.now {
    background: var(--now);
  }
  .cell.on {
    border-color: var(--ink);
  }
  .cell.on::before,
  .cell.on::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 3px;
    bottom: 3px;
    width: 2px;
    background: var(--ink);
  }
  .cell.on::before {
    transform: translateX(-50%) rotate(40deg);
  }
  .cell.on::after {
    transform: translateX(-50%) rotate(-40deg);
  }
  .cell.fire {
    background: var(--yellow);
  }
  .resting .cell {
    opacity: 0.4;
  }
  .cell:disabled,
  .slice:disabled {
    cursor: default;
  }
</style>
