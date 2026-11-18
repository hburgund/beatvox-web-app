<script lang="ts">
  // EFFECTS: the rack, in the order the sound goes through it, and RANDOMIZE!
  import Knob from '../lib/ui/Knob.svelte';
  import { ECHO_TIMES } from '../lib/audio/fx';
  import type { Session } from './session.svelte';

  let { s }: { s: Session } = $props();
  const amount = (v: number) => (v === 0 ? 'off' : `${Math.round(v)}%`);
  // the filter is off in the middle: low-pass to the left, high-pass to the right
  const filter = (v: number) => (Math.abs(v) < 4 ? 'off' : v < 0 ? `LOW ${Math.round(-v)}` : `HIGH ${Math.round(v)}`);
  const ECHO_NAMES: Record<number, string> = { 2: '1/8', 3: '1/8.', 4: '1/4' };
</script>

<section class="card fx" aria-label="Effects">
  <div class="head">
    <span class="label">EFFECTS</span>
    <button class="btn primary random" onclick={() => s.randomizeFx()}>RANDOMIZE!</button>
  </div>

  <!-- left to right in the order the sound goes through them; arrows between, where there's room -->
  <div class="dials">
    <div class="slot"><Knob label="Crush" bind:value={s.crush} format={amount} /></div>
    <div class="slot"><Knob label="Filter" bind:value={s.filter} min={-100} max={100} format={filter} /></div>
    <div class="slot"><Knob label="Wobble" bind:value={s.wobble} format={amount} /></div>
    <div class="slot"><Knob label="Echo" bind:value={s.echo} format={amount} /></div>
    <div class="slot"><Knob label="Space" bind:value={s.space} format={amount} /></div>
    <div class="slot"><Knob label="Pump" bind:value={s.pump} format={amount} /></div>
  </div>

  <div class="echo-time" role="radiogroup" aria-label="Echo time">
    <span class="meta">ECHO TIME</span>
    {#each ECHO_TIMES as t (t)}
      <button class="btn seg" class:on={s.echoTime === t} role="radio" aria-checked={s.echoTime === t} onclick={() => (s.echoTime = t)}
        >{ECHO_NAMES[t]}</button
      >
    {/each}
  </div>
</section>

<style>
  .fx {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .random {
    min-height: 40px;
  }
  .dials {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 4px;
  }
  .slot {
    position: relative;
  }
  /* a quiet arrow from each knob to the next, level with the dials (44px) */
  @media (min-width: 440px) {
    .slot:not(:last-child)::after {
      content: '→';
      position: absolute;
      top: 22px;
      right: -2px;
      transform: translate(50%, -50%);
      font-size: 18px;
      line-height: 1;
      color: var(--muted);
      opacity: 0.6;
      pointer-events: none;
    }
  }
  .echo-time {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .meta {
    font-size: 13px;
    color: var(--muted);
    margin-right: 4px;
  }
  .seg {
    min-height: 34px;
    min-width: 56px;
    padding: 0 8px;
    font-size: 13px;
  }
</style>
