<script lang="ts">
  // The 8 × 16 beat grid of ☒ boxes. Tap a box to add or remove a hit; tap a
  // slice number to rest or wake that row. The box under the playhead lights.
  // In the Mix view each row's boxes become one level bar; in the Pattern view,
  // buttons that set the row to a quick pattern. The yellow strip under each
  // slice number shows the row's level in every view.
  import { fillOf, fillPattern, type RowFill, type Voice } from '../audio/engine';
  import LevelBar from './LevelBar.svelte';

  interface Props {
    voices: Voice[];
    step: number;
    firing: number[];
    disabled?: boolean;
    /** the row a dragged slice is over */
    dropRow?: number | null;
    /** what each row shows: its boxes, a level bar, or quick patterns */
    view?: 'boxes' | 'mix' | 'pattern';
    ontoggle: (voice: number, step: number) => void;
    ontogglevoice: (voice: number) => void;
    onlevel: (voice: number, level: number) => void;
    onfill: (voice: number, fill: RowFill) => void;
  }
  let { voices, step, firing, disabled = false, dropRow = null, view = 'boxes', ontoggle, ontogglevoice, onlevel, onfill }: Props = $props();

  const FILLS: { fill: RowFill; text: string; name: string }[] = [
    { fill: '16', text: '16', name: 'every 16th note' },
    { fill: '8', text: '8', name: 'every 8th note' },
    { fill: '4', text: '4', name: 'every beat' },
    { fill: '2', text: '2', name: 'every half note' },
    { fill: 'off', text: 'UP', name: 'upbeat 8ths (between the beats)' },
    { fill: 'random', text: 'RND', name: '2 to 10 random hits' },
    { fill: 'none', text: '×', name: 'no hits' },
  ];

  // an empty grid to show before there's a voice
  const blank = Array.from({ length: 8 }, (_, i) => ({ on: true, slice: i, level: 1, pattern: Array(16).fill(false) }));
  const rows = $derived(voices.length ? voices : blank);

  /** the row and pattern under the pointer in the Pattern view (a preview) */
  let hover = $state<{ row: number; fill: RowFill } | null>(null);

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
        aria-label="Row {i + 1} plays slice {v.slice + 1}, {v.on ? 'playing' : 'resting'}, level {Math.round(v.level * 100)}%"
        onclick={() => ontogglevoice(i)}
        >{v.slice + 1}<span class="lvl" style="width:{v.level * 100}%" aria-hidden="true"></span></button
      >
      {#if view === 'pattern'}
        {@const cur = fillOf(v.pattern)}
        {@const preview = hover?.row === i ? fillPattern(hover.fill) : null}
        <div class="pick">
          <div class="fills" role="group" aria-label="Row {i + 1} pattern">
            {#each FILLS as f (f.fill)}
              <button
                class="fill"
                class:on={cur === f.fill}
                {disabled}
                aria-pressed={cur === f.fill}
                aria-label="Row {i + 1}: {f.name}"
                onpointerenter={(e) => e.pointerType === 'mouse' && (hover = { row: i, fill: f.fill })}
                onpointerleave={() => (hover = null)}
                onclick={() => onfill(i, f.fill)}>{f.text}</button
              >
            {/each}
          </div>
          <!-- the row's hits, small, lined up with the boxes; a hovered button previews its pattern -->
          <div class="ghost" class:preview aria-hidden="true">
            {#each preview ?? v.pattern as on, s (s)}
              <span class:on class:now={s === step} class:downbeat={s % 4 === 0}></span>
            {/each}
          </div>
        </div>
      {:else if view === 'mix'}
        <LevelBar
          label="Row {i + 1} level"
          value={v.level}
          lit={v.on && firing.includes(i)}
          {disabled}
          onchange={(x) => onlevel(i, x)}
        />
      {:else}
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
      {/if}
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
    position: relative;
    overflow: hidden;
  }
  .row.drop {
    outline: 2px dashed var(--pink);
    outline-offset: 2px;
    border-radius: 3px;
  }
  .lvl {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    background: var(--yellow);
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
  .pick {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .ghost {
    display: grid;
    grid-template-columns: repeat(16, minmax(0, 1fr));
    column-gap: 2px;
    height: 5px;
  }
  .ghost span {
    border-radius: 1px;
    background: var(--soft);
    opacity: 0.45;
  }
  .ghost span.downbeat:not(:first-child) {
    margin-left: 4px;
  }
  .ghost span.on {
    background: var(--blue);
    opacity: 0.7;
  }
  .ghost.preview span.on {
    background: var(--pink);
    opacity: 1;
  }
  .ghost span.now {
    outline: 1px solid var(--ink);
  }
  .fills {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 3px;
  }
  .fill {
    height: 17px;
    padding: 0;
    border: 1.5px solid var(--ink);
    border-radius: 3px;
    background: var(--card);
    color: var(--ink);
    font: 700 11px var(--mono);
    cursor: pointer;
    touch-action: manipulation;
  }
  .fill.on {
    background: var(--blue);
    border-color: var(--blue);
    color: #fff;
  }
  .fill:active {
    background: var(--yellow);
    color: var(--ink);
  }
  .resting .cell,
  .resting .fills,
  .resting :global(.level) {
    opacity: 0.4;
  }
  .cell:disabled,
  .fill:disabled,
  .slice:disabled {
    cursor: default;
  }
</style>
