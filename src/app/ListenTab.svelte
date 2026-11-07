<script lang="ts">
  import RingButton from '../lib/maxkit/RingButton.svelte';
  import Slider from '../lib/maxkit/Slider.svelte';
  import Toggle from '../lib/maxkit/Toggle.svelte';
  import Knob from '../lib/maxkit/Knob.svelte';
  import BeatGrid from '../lib/maxkit/BeatGrid.svelte';
  import type { Session } from './session.svelte';

  let { s, narrow }: { s: Session; narrow: boolean } = $props();
  const ready = $derived(s.slices.length > 0);
  const pct = (v: number) => String(Math.round(v));
</script>

<section class="listen" class:narrow>
  <h2>Make Beats With Your Voice</h2>

  {#if !ready}
    <p class="empty">Record your voice first, then press NEXT.</p>
  {/if}

  <div class="main">
    <div class="transport">
      <RingButton label="Go!" color="green" disabled={!ready} pressed={s.playing} onclick={() => s.go()} />
      <RingButton label="Stop" color="red" disabled={!ready} onclick={() => s.stopBeat()} />
      <RingButton label="New" color="blue" onclick={() => s.newPerson()} />
    </div>

    {#if !narrow}
      <div class="volume">
        <Slider label="Volume" bind:value={s.volume} min={0} max={100} />
      </div>
    {/if}

    <div class="modify">
      <h3>Modify</h3>
      <div class="mods">
        <div class="mod">
          <RingButton label="New Beat" inner="" color="blue" size={narrow ? 44 : 52} disabled={!ready} onclick={() => s.newBeat()} />
          <span>New Beat</span>
        </div>
        <div class="mod">
          <RingButton label="Evolve Beat" inner="" color="blue" size={narrow ? 44 : 52} disabled={!ready} onclick={() => s.evolve()} />
          <span>Evolve Beat</span>
        </div>
      </div>
      <Toggle label="keep evolving" checked={s.autoEvolve} onchange={(v) => s.setAutoEvolve(v)} />
    </div>

    {#if !narrow}
      <div class="right">
        <Slider label="Tempo" bind:value={s.bpm} min={40} max={180} />
        <Slider label="Panning" bind:value={s.panning} min={0} max={100} />
        <Slider label="Pitch" bind:value={s.pitch} min={0.5} max={2} step={0.01} format={(v) => v.toFixed(2)} />
        <div class="space">
          <Knob label="Space" bind:value={s.space} format={pct} />
        </div>
      </div>
    {/if}
  </div>

  <BeatGrid voices={s.voices} step={s.step} firing={s.firing} />

  {#if narrow}
    <div class="controls">
      <Slider vertical={false} label="Volume" bind:value={s.volume} min={0} max={100} />
      <Slider vertical={false} label="Tempo" bind:value={s.bpm} min={40} max={180} />
      <Slider vertical={false} label="Panning" bind:value={s.panning} min={0} max={100} />
      <Slider vertical={false} label="Pitch" bind:value={s.pitch} min={0.5} max={2} step={0.01} format={(v) => v.toFixed(2)} />
      <div class="space">
        <Knob label="Space" bind:value={s.space} size={52} format={pct} />
      </div>
    </div>
  {/if}
</section>

<style>
  .listen {
    padding: 10px 18px 18px;
  }
  h2 {
    text-align: center;
    font-size: 15px;
    margin: 4px 0 14px;
  }
  .empty {
    text-align: center;
    color: #345;
    margin: -6px 0 12px;
  }
  .main {
    display: grid;
    grid-template-columns: auto auto minmax(220px, 1fr) auto;
    gap: 18px;
    align-items: start;
    margin-bottom: 16px;
  }
  .transport {
    display: grid;
    gap: 12px;
  }
  .modify {
    background: var(--bv-yellow);
    border: 1px solid var(--bv-yellow-edge);
    border-radius: 10px;
    padding: 10px 14px 12px;
    display: grid;
    justify-items: center;
    gap: 10px;
    align-self: stretch;
  }
  h3 {
    margin: 0;
    font-size: 15px;
  }
  .mods {
    display: flex;
    gap: 22px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .mod {
    display: flex;
    align-items: center;
    gap: 8px;
    font: bold 12px Arial, sans-serif;
  }
  .right {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 10px 14px;
  }
  .right .space {
    grid-column: 1 / -1;
    justify-self: center;
  }

  /* phone */
  .narrow {
    padding: 8px 12px 14px;
  }
  .narrow .main {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .narrow .transport {
    grid-auto-flow: column;
    justify-content: center;
    gap: 18px;
  }
  .narrow .mods {
    gap: 14px;
  }
  .controls {
    display: grid;
    gap: 10px;
    margin-top: 14px;
  }
  .controls .space {
    justify-self: center;
    margin-top: 4px;
  }
</style>
