<script lang="ts">
  // The small loop button: a play button with the beat's 16 steps around it.
  // A step is filled where any playing row hits; while it plays, the current
  // step lights.
  import type { RingRow } from '../shared';

  interface Props {
    rows: RingRow[];
    playing?: boolean;
    loading?: boolean;
    step?: number;
    label: string;
    /** this beat (pink) or another (yellow) */
    current?: boolean;
    onclick: () => void;
  }
  let { rows, playing = false, loading = false, step = -1, label, current = false, onclick }: Props = $props();

  const C = 24; // centre in a 48 × 48 box
  const marks = $derived(
    Array.from({ length: 16 }, (_, k) => {
      const a = (k / 16) * 2 * Math.PI;
      return {
        k,
        x: C + 20 * Math.sin(a),
        y: C - 20 * Math.cos(a),
        hit: rows.some((r) => r.on && r.hits[k]),
      };
    }),
  );
</script>

<button class="clock" class:current aria-label={label} aria-pressed={playing} {onclick}>
  <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
    {#each marks as m (m.k)}
      <rect
        x={m.x - 2.6}
        y={m.y - 2.6}
        width="5.2"
        height="5.2"
        transform="rotate({m.k * 22.5} {m.x} {m.y})"
        class:hit={m.hit}
        class:now={playing && m.k === step}
      />
    {/each}
    <circle cx={C} cy={C} r="13" class="face" />
    {#if loading}
      <circle cx={C} cy={C} r="4" class="icon" />
    {:else if playing}
      <rect x={C - 5} y={C - 5} width="10" height="10" class="icon" />
    {:else}
      <path d="M{C - 4} {C - 6} L{C + 6} {C} L{C - 4} {C + 6} Z" class="icon" />
    {/if}
  </svg>
</button>

<style>
  .clock {
    width: 48px;
    height: 48px;
    flex: none;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    touch-action: manipulation;
  }
  rect {
    fill: var(--card);
    stroke: var(--soft);
    stroke-width: 1;
  }
  rect.hit {
    fill: var(--ink);
    stroke: var(--ink);
  }
  rect.now {
    fill: var(--yellow);
    stroke: var(--ink);
    stroke-width: 1.4;
  }
  .face {
    fill: var(--yellow);
    stroke: var(--ink);
    stroke-width: 2;
  }
  .current .face {
    fill: var(--pink);
  }
  .icon {
    fill: var(--ink);
  }
  .clock:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
    border-radius: 50%;
  }
</style>
