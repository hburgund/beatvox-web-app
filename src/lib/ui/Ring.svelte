<script lang="ts">
  // A beat drawn as a circle: 8 rings of 16 steps, row 1 outside, steps
  // clockwise from the top. A hit is filled with its sound's color (kick
  // blue, snare pink, hat yellow, anything else ink), as in the studio grid.
  // A wedge marks the step playing. Whatever goes in the middle (the play
  // button) is passed as children.
  import type { Snippet } from 'svelte';
  import type { RingRow } from '../shared';

  interface Props {
    rows: RingRow[];
    /** the step playing, or -1 */
    step?: number;
    /** diameter in px */
    size?: number;
    /** the empty middle, as a fraction of the radius */
    hole?: number;
    label?: string;
    children?: Snippet;
  }
  let { rows, step = -1, size = 330, hole = 0.36, label = 'The beat as a circle', children }: Props = $props();

  const R = 100; // drawing units; the svg scales to size
  const r0 = $derived(R * hole);
  const band = $derived((R - r0) / 8);

  const FILL: Record<string, string> = { kick: 'var(--blue)', snare: 'var(--pink)', hat: 'var(--yellow)' };

  const cells = $derived(
    rows.flatMap((row, i) => {
      const rad = R - band * (i + 0.5);
      const s = Math.min(band * 0.8, ((2 * Math.PI * rad) / 16) * 0.64);
      return row.hits.map((hit, k) => {
        const a = (k / 16) * 2 * Math.PI;
        return {
          key: i * 16 + k,
          x: R + rad * Math.sin(a),
          y: R - rad * Math.cos(a),
          s,
          rot: k * 22.5,
          hit,
          on: row.on,
          fill: hit ? (FILL[row.sound ?? ''] ?? 'var(--ink)') : k % 4 === 0 ? 'var(--paper)' : 'var(--card)',
          firing: hit && row.on && k === step,
        };
      });
    }),
  );

  function wedge(k: number) {
    const a0 = ((k - 0.5) / 16) * 2 * Math.PI;
    const a1 = ((k + 0.5) / 16) * 2 * Math.PI;
    const ri = r0 - 2;
    const ro = R;
    const p = (r: number, a: number) => `${(R + r * Math.sin(a)).toFixed(2)} ${(R - r * Math.cos(a)).toFixed(2)}`;
    return `M${p(ri, a0)} L${p(ro, a0)} A${ro} ${ro} 0 0 1 ${p(ro, a1)} L${p(ri, a1)} A${ri} ${ri} 0 0 0 ${p(ri, a0)} Z`;
  }
</script>

<div class="ring" style="width:{size}px;height:{size}px">
  <svg viewBox="0 0 {2 * R} {2 * R}" width={size} height={size} role="img" aria-label={label}>
    {#if step >= 0}
      <path class="wedge" d={wedge(step)} />
    {/if}
    {#each cells as c (c.key)}
      <rect
        x={c.x - c.s / 2}
        y={c.y - c.s / 2}
        width={c.s}
        height={c.s}
        rx={c.s * 0.14}
        transform="rotate({c.rot} {c.x} {c.y})"
        fill={c.fill}
        class:hit={c.hit}
        class:resting={!c.on}
        class:firing={c.firing}
      />
    {/each}
  </svg>
  {#if children}
    <div class="middle">{@render children()}</div>
  {/if}
</div>

<style>
  .ring {
    position: relative;
    flex: none;
  }
  svg {
    display: block;
    overflow: visible;
  }
  rect {
    stroke: var(--soft);
    stroke-width: 0.6;
  }
  rect.hit {
    stroke: var(--ink);
    stroke-width: 0.8;
  }
  rect.resting {
    opacity: 0.3;
  }
  rect.firing {
    stroke-width: 1.8;
  }
  .wedge {
    fill: var(--yellow);
    opacity: 0.4;
  }
  .middle {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .middle > :global(*) {
    pointer-events: auto;
  }
</style>
