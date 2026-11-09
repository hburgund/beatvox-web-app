<script lang="ts">
  // BEAT: the grid, play/stop, New beat, Evolve, Style and the dials.
  import Grid from '../lib/ui/Grid.svelte';
  import Knob from '../lib/ui/Knob.svelte';
  import Check from '../lib/ui/Check.svelte';
  import { STYLES } from '../lib/styles';
  import type { Session } from './session.svelte';

  let { s }: { s: Session } = $props();
  const ready = $derived(s.slices.length > 0);
  const pct = (v: number) => `${Math.round(v)}%`;
  /** boxes, level bars (MIX) or quick patterns (PATTERN) */
  let view = $state<'boxes' | 'mix' | 'pattern'>('boxes');
  const flip = (v: 'mix' | 'pattern') => (view = view === v ? 'boxes' : v);
</script>

<section class="card beat" aria-label="Beat">
  <div class="head">
    <span class="label">BEAT</span>
    <button class="btn mix" class:on={view === 'mix'} aria-pressed={view === 'mix'} disabled={!ready} onclick={() => flip('mix')}>MIX</button>
    <button class="btn mix" class:on={view === 'pattern'} aria-pressed={view === 'pattern'} disabled={!ready} onclick={() => flip('pattern')}>PATTERN</button>
    <label class="style">
      <span class="meta">STYLE</span>
      <select value={s.style} disabled={!ready} onchange={(e) => s.applyStyle(e.currentTarget.value)}>
        <option value="">random (v1.93)</option>
        {#each STYLES as st (st.name)}<option value={st.name}>{st.name}</option>{/each}
      </select>
    </label>
  </div>

  <Grid
    voices={s.voices}
    step={s.step}
    firing={s.firing}
    disabled={!ready}
    dropRow={s.dropRow}
    {view}
    onlevel={(v, x) => s.setLevel(v, x)}
    onfill={(v, f) => s.fillRow(v, f)}
    ontoggle={(v, i) => s.toggleStep(v, i)}
    ontogglevoice={(v) => s.toggleVoice(v)}
  />
  {#if !ready}
    <p class="empty">Your beat shows up here. Tap a box to add or remove a hit.</p>
  {:else if view === 'mix'}
    <p class="empty">Drag along a row to set its level. Tap MIX to go back to the boxes.</p>
  {:else if view === 'pattern'}
    <p class="empty">Set a row to hits on every 16th, 8th, beat or half note, the upbeats (UP), 2–10 random hits, or none. Evolve leaves those rows alone.</p>
  {/if}

  <div class="transport">
    <button
      class="btn round"
      disabled={!ready}
      aria-label={s.playing ? 'Stop the beat' : 'Play the beat'}
      onclick={() => (s.playing ? s.stopBeat() : s.go())}
    >
      {#if s.playing}
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="3" width="12" height="12" fill="currentColor" /></svg>
      {:else}
        <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 2l11 7-11 7z" fill="currentColor" /></svg>
      {/if}
    </button>
    <button class="btn" disabled={!ready} onclick={() => s.newBeat()}>NEW BEAT</button>
    <button class="btn" disabled={!ready} onclick={() => s.evolve()}>EVOLVE</button>
  </div>

  <Check bind:checked={() => s.autoEvolve, (v) => s.setAutoEvolve(v)} disabled={!ready}>keep evolving</Check>

  <div class="dials">
    <Knob label="Vol" bind:value={s.volume} />
    <Knob label="Tempo" bind:value={s.bpm} min={40} max={180} />
    <Knob label="Pan" bind:value={s.panning} />
    <Knob label="Pitch" bind:value={s.pitch} min={0.5} max={2} step={0.01} format={(v) => v.toFixed(2)} />
    <Knob label="Space" bind:value={s.space} format={pct} />
  </div>
</section>

<style>
  .beat {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .mix {
    min-height: 36px;
    padding: 0 10px;
    font-size: 13px;
  }
  .mix + .mix {
    margin-right: auto;
  }
  .style {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  /* on a phone the menu itself says what it is */
  @media (max-width: 440px) {
    .meta {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  }
  .meta {
    font-size: 13px;
    color: var(--muted);
  }
  select {
    min-height: 36px;
    max-width: 150px;
    min-width: 0;
    width: 100%;
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    background: var(--card);
    font: 700 13px var(--mono);
    padding: 0 6px;
  }
  .empty {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    text-align: center;
  }
  .transport {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .transport .btn:not(.round) {
    flex: 1;
  }
  .dials {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
  }
</style>
