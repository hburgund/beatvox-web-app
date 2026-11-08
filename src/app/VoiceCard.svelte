<script lang="ts">
  // VOICE: record (or open a file), then see it cut into slices.
  import Wave from '../lib/ui/Wave.svelte';
  import Check from '../lib/ui/Check.svelte';
  import { MAX_RECORD_SEC, type Session } from './session.svelte';

  let { s }: { s: Session } = $props();

  const hasVoice = $derived(!!s.voice && !s.recording);
  const meta = $derived(
    s.recording
      ? 'RECORDING…'
      : s.voice
        ? `${s.voice.duration.toFixed(1)} S · ${s.slices.length} SLICES`
        : `UP TO ${MAX_RECORD_SEC} S`,
  );
  // slices the beat is playing, and the ones sounding right now
  const used = $derived(s.voices.filter((v) => v.on).map((v) => v.slice));
  const lit = $derived(s.firing.map((i) => s.voices[i]?.slice).filter((x) => x !== undefined));
  // 12 bars that bounce with the mic level
  const bars = $derived(Array.from({ length: 12 }, (_, i) => (s.recording ? Math.min(1, Math.sqrt(s.level) * (1.6 - Math.abs(i - 5.5) / 7)) : 0)));

  // dev only: the local 2008 reference recordings (never in a build)
  let refs = $state<{ group: string; name: string; path: string }[]>([]);
  if (import.meta.env.DEV) {
    fetch('/__ref/list')
      .then((r) => r.json())
      .then((list) => (refs = list))
      .catch(() => {});
  }
  function pickRef(e: Event) {
    const path = (e.currentTarget as HTMLSelectElement).value;
    if (path) void s.loadUrl('/__ref/' + path.split('/').map(encodeURIComponent).join('/'));
  }
  function pickFile(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (f) void s.loadFile(f);
  }
</script>

<section class="card voice" aria-label="Voice">
  <div class="head">
    <span class="label">VOICE</span>
    <span class="meta">{meta}</span>
  </div>

  {#if hasVoice}
    <Wave
      mono={s.mono}
      sampleRate={s.voice?.sampleRate ?? 44100}
      slices={s.slices}
      position={s.reviewPos}
      {lit}
      {used}
      onslice={(i) => s.hearSlice(i)}
      ondrop={(i, row) => s.setSlice(row, i)}
      onover={(row) => (s.dropRow = row)}
    />
    <p class="tip">Tap a slice to hear it. Drag it onto a beat row to play it there.</p>
    <div class="row">
      <button class="btn" onclick={() => s.toggleRecord()}><span class="dot"></span>RE-RECORD</button>
      <button class="btn" class:on={s.reviewing} onclick={() => s.toggleReview()}>
        {#if s.reviewing}
          <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="3" width="12" height="12" fill="currentColor" /></svg>STOP
        {:else}
          <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 2l12 7-12 7z" fill="currentColor" /></svg>HEAR IT
        {/if}
      </button>
    </div>
  {:else}
    {#if !s.recording}
      <p class="intro">Say anything for up to {MAX_RECORD_SEC} seconds: your name, a word, a beatbox. BeatVox cuts it into slices and makes a beat.</p>
    {/if}
    <div class="recorder">
      <button class="rec" class:live={s.recording} onclick={() => s.toggleRecord()} aria-label={s.recording ? 'Stop recording' : 'Start recording'}>
        <span class="mark" class:stop={s.recording}></span>
        {s.recording ? 'STOP' : 'RECORD'}
      </button>
      <div class="count">
        <span class="num" aria-live="off">{s.remaining}</span>
        <span class="meta">{s.recording ? 'seconds left' : 'seconds to record'}</span>
        <div class="level" aria-hidden="true">
          {#each bars as b, i (i)}<span style="height:{4 + b * 16}px" class:live={s.recording}></span>{/each}
        </div>
      </div>
    </div>
    {#if !s.recording}
      <div class="row extras">
        <Check bind:checked={s.noisyRoom}>noisy room</Check>
        <label class="link file">
          open a sound file
          <input type="file" accept="audio/*" onchange={pickFile} />
        </label>
      </div>
    {/if}
  {/if}

  {#if s.status && !s.recording && !/^\d+ slices$/.test(s.status)}<p class="status" aria-live="polite">{s.status}</p>{/if}
  {#if refs.length && !s.recording}
    <select class="dev" onchange={pickRef} aria-label="Reference recording (dev only)">
      <option value="">dev: reference recordings…</option>
      {#each refs as r (r.path)}<option value={r.path}>{r.group} / {r.name}</option>{/each}
    </select>
  {/if}
</section>

<style>
  .voice {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .meta {
    font-size: 13px;
    color: var(--muted);
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row .btn {
    flex: 1;
  }
  .tip {
    margin: -4px 0 0;
    font: 12px var(--sans);
    color: var(--muted);
  }
  .intro {
    margin: 0;
    font: 15px/1.4 var(--sans);
  }
  .recorder {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .rec {
    width: 92px;
    height: 92px;
    flex: none;
    border-radius: 50%;
    border: 2.5px solid var(--ink);
    background: var(--pink);
    font: 700 15px var(--mono);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    box-shadow: 3px 3px 0 var(--blue);
    touch-action: manipulation;
  }
  .rec:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--blue);
  }
  .rec.live {
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      box-shadow: 3px 3px 0 var(--blue), 0 0 0 8px rgba(255, 92, 128, 0.25);
    }
  }
  .mark {
    width: 20px;
    height: 20px;
    box-sizing: border-box;
    border-radius: 50%;
    background: var(--card);
    border: 2px solid var(--ink);
  }
  .mark.stop {
    width: 18px;
    height: 18px;
    border-radius: 0;
    background: var(--ink);
  }
  .count {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .num {
    font-weight: 700;
    font-size: 44px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .level {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 20px;
  }
  .level span {
    width: 5px;
    background: var(--soft);
    transition: height 60ms linear;
  }
  .level span.live {
    background: var(--blue);
  }
  .extras {
    justify-content: space-between;
    align-items: center;
  }
  .file {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-weight: 700;
  }
  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .status {
    margin: 0;
    font-size: 13px;
    color: var(--error);
  }
  .dev {
    font-size: 12px;
    max-width: 100%;
  }
</style>
