<script lang="ts">
  // The 8 × 16 beat grid. Tap a box to add or remove a hit; tap a slice number
  // to rest or wake that row. A hit is filled with the color of its slice's
  // sound (kick blue, snare pink, hat yellow, anything else ink), the same
  // colors the share image uses. The column under the playhead lights.
  // In the Mix view each row's boxes become one level bar. The Pattern view
  // slides a menu in before each row's boxes to set a quick pattern. The yellow
  // strip under each slice number shows the row's level in every view.
  import { fillOf, type RowFill, type Voice } from '../audio/engine';
  import LevelBar from './LevelBar.svelte';

  interface Props {
    voices: Voice[];
    step: number;
    firing: number[];
    disabled?: boolean;
    /** the row a dragged slice is over */
    dropRow?: number | null;
    /** each slice's sound ('kick', 'snare', 'hat', 'perc', 'tonal'), by slice number */
    sounds?: (string | undefined)[];
    /** what each row shows: its boxes, a level bar, or quick patterns */
    view?: 'boxes' | 'mix' | 'pattern';
    ontoggle: (voice: number, step: number) => void;
    ontogglevoice: (voice: number) => void;
    onlevel: (voice: number, level: number) => void;
    onfill: (voice: number, fill: RowFill) => void;
  }
  let { voices, step, firing, disabled = false, dropRow = null, sounds = [], view = 'boxes', ontoggle, ontogglevoice, onlevel, onfill }: Props = $props();

  // the menu's choices; '···' shows when the row's hits match none of them
  const FILLS: { fill: RowFill; text: string }[] = [
    { fill: '16', text: '1/16' },
    { fill: '8', text: '1/8' },
    { fill: '4', text: '1/4' },
    { fill: '2', text: '1/2' },
    { fill: 'off', text: 'UP' },
    { fill: 'random', text: 'RND' },
    { fill: 'none', text: 'none' },
  ];

  // sound → the color class of a hit
  const COLOR: Record<string, string> = { kick: 'kick', snare: 'snare', hat: 'hat' };

  // an empty grid to show before there's a voice
  const blank: Pick<Voice, 'on' | 'slice' | 'level' | 'pattern' | 'fill'>[] = Array.from({ length: 8 }, (_, i) => ({ on: true, slice: i, level: 1, pattern: Array(16).fill(false) }));
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
<div class="grid" class:disabled class:patterns={view === 'pattern'} role="group" aria-label="Beat: {rows.filter((v) => v.on).length} of {rows.length} slices playing" onkeydown={move}>
  {#each rows as v, i (i)}
    {@const shown = v.fill ?? fillOf(v.pattern) ?? ''}
    <div class="row" class:resting={!v.on} class:drop={dropRow === i} data-row={i}>
      <button
        class="slice"
        {disabled}
        aria-pressed={v.on}
        aria-label="Row {i + 1} plays slice {v.slice + 1}, {v.on ? 'playing' : 'resting'}, level {Math.round(v.level * 100)}%"
        onclick={() => ontogglevoice(i)}
        >{v.slice + 1}<span class="lvl" style="width:{v.level * 100}%" aria-hidden="true"></span></button
      >
      <!-- the Pattern view slides a menu in here; the boxes squeeze over and show each pick at once -->
      <div class="pick" inert={view !== 'pattern'}>
        <select
          class:set={shown !== ''}
          value={shown}
          {disabled}
          aria-label="Row {i + 1} pattern"
          onchange={(e) => {
            const f = e.currentTarget.value;
            onfill(i, (f === 'again' ? 'random' : f) as RowFill);
            // show RND again so the next re-roll is a change too
            if (f === 'again') e.currentTarget.value = 'random';
          }}
        >
          <option value="" disabled>···</option>
          {#each FILLS as f (f.fill)}<option value={f.fill}>{f.text}</option>{/each}
          {#if v.fill === 'random'}<option value="again">RND again</option>{/if}
        </select>
      </div>
      {#if view === 'mix'}
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
            class="cell {on ? `hit-${COLOR[sounds[v.slice] ?? ''] ?? 'other'}` : ''}"
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
  .cell.hit-kick {
    background: var(--blue);
  }
  .cell.hit-snare {
    background: var(--pink);
  }
  .cell.hit-hat {
    background: var(--yellow);
  }
  .cell.hit-other {
    background: var(--ink);
  }
  /* the playhead: empty boxes light, hits get a ring */
  .cell.now.on {
    box-shadow: 0 0 0 2px var(--now);
  }
  .cell.fire {
    box-shadow:
      0 0 0 2px var(--card),
      0 0 0 4px var(--ink);
    z-index: 1;
  }
  /* the pattern menu: no width until the Pattern view, then it slides in */
  .pick {
    flex: none;
    width: 0;
    margin-left: -6px;
    overflow: hidden;
    opacity: 0;
    transition:
      width 220ms ease,
      margin 220ms ease,
      opacity 160ms ease;
  }
  .patterns .pick {
    width: 62px;
    margin-left: 0;
    opacity: 1;
  }
  .pick select {
    width: 62px;
    height: 24px;
    box-sizing: border-box;
    padding: 0 2px;
    border: 1.5px solid var(--ink);
    border-radius: 3px;
    background: var(--card);
    color: var(--ink);
    font: 700 12px var(--mono);
    cursor: pointer;
  }
  .pick select.set {
    background: var(--yellow);
  }
  @media (prefers-reduced-motion: reduce) {
    .pick {
      transition: none;
    }
  }
  .resting .cell,
  .resting :global(.level) {
    opacity: 0.4;
  }
  .cell:disabled,
  .slice:disabled {
    cursor: default;
  }
</style>
