<script lang="ts">
  import RingButton from '../lib/maxkit/RingButton.svelte';
  import Toggle from '../lib/maxkit/Toggle.svelte';
  import Waveform from '../lib/maxkit/Waveform.svelte';
  import type { Session } from './session.svelte';

  let { s }: { s: Session } = $props();

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

<section class="record">
  <h2>Record Your Voice</h2>

  <div class="top">
    <div class="steps">
      <div class="line">
        <RingButton label="New" color="blue" size={34} onclick={() => s.newPerson()} />
        <span class="hint">Start over</span>
      </div>
      <div class="line">
        <button class="pill" class:live={s.recording} onclick={() => s.toggleRecord()}>
          {s.recording ? 'STOP' : 'RECORD'}
        </button>
        <span class="hint">{s.recording ? 'Press to stop early' : 'Press to begin recording'}</span>
      </div>
      <div class="line">
        <span class="lcd" class:live={s.recording} aria-label="{s.remaining} seconds left">{s.remaining}</span>
        <span class="hint">Recording time countdown</span>
      </div>
      <div class="line">
        <button class="pill" class:on={s.reviewing} disabled={!s.voice || s.recording} onclick={() => s.toggleReview()}>
          {s.reviewing ? 'STOP' : 'PLAY'}
        </button>
        <span class="hint">Listen to your recording</span>
      </div>
    </div>

    <div class="next">
      <RingButton label="Next" color="green" size={68} disabled={!s.slices.length || s.recording} onclick={() => s.next()} />
      <span class="hint">{s.slices.length ? 'Make a beat!' : ''}</span>
    </div>
  </div>

  <Waveform mono={s.mono} sampleRate={s.voice?.sampleRate ?? 44100} slices={s.slices} position={s.reviewPos} level={s.level} recording={s.recording} />

  <div class="foot">
    <span class="status" aria-live="polite">{s.status}</span>
    <Toggle label="noisy room" checked={s.noisyRoom} onchange={(v) => (s.noisyRoom = v)} />
    <label class="pill small file">
      open file
      <input type="file" accept="audio/*" onchange={pickFile} />
    </label>
    {#if refs.length}
      <select onchange={pickRef} aria-label="Reference recording (dev only)">
        <option value="">dev: reference recordings…</option>
        {#each refs as r (r.path)}<option value={r.path}>{r.group} / {r.name}</option>{/each}
      </select>
    {/if}
  </div>
</section>

<style>
  .record {
    padding: 10px 18px 18px;
  }
  h2 {
    text-align: center;
    font-size: 15px;
    margin: 4px 0 14px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  .steps {
    display: grid;
    gap: 12px;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .line .pill {
    min-width: 110px;
  }
  .lcd {
    font: bold 26px/1 Arial, sans-serif;
    border: 2px solid #222;
    border-radius: 3px;
    background: #f4f4f4;
    width: 44px;
    text-align: center;
    padding: 5px 0;
    margin-left: 32px;
    margin-right: 32px;
    font-variant-numeric: tabular-nums;
  }
  .lcd.live {
    background: #ff5b5b;
    color: #fff;
  }
  .next {
    display: grid;
    justify-items: center;
    gap: 6px;
    margin-right: 40px;
  }
  .foot {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-top: 10px;
  }
  .status {
    flex: 1 1 200px;
    font-size: 12px;
    color: #234;
  }
  .file {
    position: relative;
    overflow: hidden;
  }
  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  select {
    max-width: 220px;
  }

  @media (max-width: 640px) {
    .record {
      padding: 8px 12px 14px;
    }
    .top {
      flex-direction: column;
      align-items: stretch;
    }
    .lcd {
      margin: 0 33px;
    }
    .next {
      margin: 0;
      grid-auto-flow: column;
      justify-content: center;
      align-items: center;
    }
  }
</style>
