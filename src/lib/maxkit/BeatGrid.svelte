<script lang="ts">
  // The 8 × 16 grid of ☒ boxes. A box lights yellow when its hit plays.
  // Rows for voices that are resting are dimmed.
  import type { Voice } from '../audio/engine';

  interface Props {
    voices: Voice[];
    step: number;
    firing: number[];
  }
  let { voices, step, firing }: Props = $props();
</script>

<div class="grid" role="img" aria-label="Beat pattern: {voices.filter((v) => v.on).length} voices playing">
  {#each voices as v, i (i)}
    <div class="row" class:off={!v.on}>
      {#each [0, 4, 8, 12] as g (g)}
        <div class="group">
          {#each v.pattern.slice(g, g + 4) as on, k (k)}
            {@const s = g + k}
            <span class="cell" class:on class:now={s === step} class:fire={s === step && on && v.on && firing.includes(i)}></span>
          {/each}
        </div>
      {/each}
    </div>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    gap: 3px;
    width: 100%;
    max-width: 440px;
    margin: 0 auto;
    padding: 8px 0;
    border-top: 1px solid #666;
    border-bottom: 1px solid #666;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: 7px;
    transition: opacity 200ms;
  }
  .group {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 3px;
  }
  .row.off {
    opacity: 0.35;
  }
  .cell {
    aspect-ratio: 1;
    border: 1px solid #555;
    background: #fff;
    position: relative;
    box-sizing: border-box;
  }
  .cell.now {
    border-color: #000;
    box-shadow: 0 0 0 1px #8899aa;
  }
  .cell.on::before,
  .cell.on::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1.2px;
    background: #333;
  }
  .cell.on::before { transform: translateX(-50%) rotate(45deg); }
  .cell.on::after { transform: translateX(-50%) rotate(-45deg); }
  .cell.fire {
    background: var(--bv-led);
  }
</style>
