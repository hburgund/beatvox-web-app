<script lang="ts">
  import { onMount } from 'svelte';
  import Lane from './Lane.svelte';
  import { analyze, toMono, type Features } from '../lib/audio/analysis';
  import { sliceSignal, DEFAULT_PARAMS, METHODS, type SliceMethod, type SliceParams, type SliceResult } from '../lib/audio/slicer';
  import { slicePitch, noteName, type PitchResult } from '../lib/audio/pitch';
  import { bestRole, DRUM_ROLES, roleScores, sliceTraits, type RoleScores } from '../lib/audio/drumRoles';
  import { BeatPreview, playSlice, STEPS } from '../lib/audio/beatPreview';
  import { startRecording, type Recording } from '../lib/audio/recorder';

  type Ref = { group: string; name: string; path: string };

  const INFO: Record<SliceMethod, { label: string; hint: string }> = {
    attacks: { label: 'Attacks', hint: 'cuts at consonant attacks (spectral flux)' },
    syllables: { label: 'Syllables', hint: 'one slice per syllable (dips in the speech-band envelope)' },
    mixed: { label: 'Mixed', hint: 'syllables, snapped to and split at strong attacks' },
  };

  // ---------- persisted settings (per device) ----------
  const load = <T,>(k: string, d: T): T => {
    try { const v = localStorage.getItem(k); return v ? { ...d, ...JSON.parse(v) } : d; } catch { return d; }
  };
  const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // ---------- state ----------
  let ctx: AudioContext | null = null;
  let refs = $state<Ref[]>([]);
  let refIndex = $state(-1);
  let sourceName = $state('');
  let status = $state('');
  let buffer = $state.raw<AudioBuffer | null>(null);
  let mono = $state.raw<Float32Array | null>(null);
  let features = $state.raw<Features | null>(null);
  let params = $state<SliceParams>(load('bv-lab-params', DEFAULT_PARAMS));
  let showCurve = $state(true);
  let beatMethod = $state<SliceMethod>('mixed');
  let tableMethod = $state<SliceMethod>('mixed');
  let sortByPitch = $state(false);
  let sortByRole = $state(false);
  let votes = $state<Record<string, SliceMethod>>(load('bv-lab-votes', {}));
  let voiceCount = $state(4);
  let bpm = $state(89);
  let playing = $state(false);
  let steps = $state<boolean[][]>([]);
  let stepNow = $state(-1);
  let voiceSlices = $state<number[]>([]);
  let voiceProcessing = $state(false);
  let rec = $state.raw<Recording | null>(null);
  let recLeft = $state(0);
  let recLevel = $state(0);
  let pitches = $state.raw<PitchResult[]>([]);
  let roles = $state.raw<RoleScores[]>([]);

  let lanes: Record<string, Lane> = {};
  let beat: BeatPreview | null = null;

  const results = $derived.by(() => {
    if (!mono || !features || !buffer) return null;
    const p = $state.snapshot(params);
    const out = {} as Record<SliceMethod, SliceResult>;
    for (const m of METHODS) out[m] = sliceSignal(mono, buffer.sampleRate, m, p, features);
    return out;
  });

  $effect(() => save('bv-lab-params', $state.snapshot(params)));
  $effect(() => save('bv-lab-votes', $state.snapshot(votes)));

  // keep the beat on the chosen method's slices as params change
  $effect(() => {
    const r = results?.[beatMethod];
    if (beat && r) { beat.setSlices(r.slices); syncBeatView(); }
  });

  // pitch for the table, debounced (YIN is the slow part)
  $effect(() => {
    const r = results?.[tableMethod];
    const m = mono, b = buffer;
    if (!r || !m || !b) { pitches = []; roles = []; return; }
    const id = setTimeout(() => {
      pitches = r.slices.map((s) => slicePitch(m, b.sampleRate, s.start, s.end));
      roles = roleScores(r.slices.map((s) => sliceTraits(m, b.sampleRate, s)));
    }, 200);
    return () => clearTimeout(id);
  });

  const tableRows = $derived.by(() => {
    const r = results?.[tableMethod];
    if (!r) return [];
    const rows = r.slices.map((s, i) => {
      const sc = roles[i];
      const role = sc ? bestRole(sc) : null;
      return { i, s, p: pitches[i], role, score: sc && role ? sc[role] : 0 };
    });
    if (sortByPitch) rows.sort((a, b) => (a.p?.hz ?? 1e9) - (b.p?.hz ?? 1e9));
    if (sortByRole) rows.sort((a, b) => DRUM_ROLES.indexOf(a.role!) - DRUM_ROLES.indexOf(b.role!) || b.score - a.score);
    return rows;
  });

  const tally = $derived.by(() => {
    const t: Record<SliceMethod, number> = { attacks: 0, syllables: 0, mixed: 0 };
    for (const v of Object.values(votes)) t[v]++;
    return t;
  });
  const currentKey = $derived(refIndex >= 0 ? refs[refIndex]?.path : sourceName);

  // ---------- audio ----------
  function audio() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  async function setSource(buf: AudioBuffer, name: string) {
    stopBeat();
    buffer = buf;
    mono = toMono(buf);
    features = analyze(mono, buf.sampleRate);
    sourceName = name;
    status = `${(buf.duration).toFixed(1)} s · ${buf.sampleRate} Hz`;
  }

  async function loadRef(i: number) {
    if (!refs.length) return;
    refIndex = (i + refs.length) % refs.length;
    const r = refs[refIndex];
    status = 'loading…';
    try {
      const data = await (await fetch('/__ref/' + r.path.split('/').map(encodeURIComponent).join('/'))).arrayBuffer();
      await setSource(await audio().decodeAudioData(data), r.name);
    } catch (e) {
      status = `couldn't decode ${r.name} (${(e as Error).message})`;
    }
  }

  async function loadFile(file: File) {
    try {
      refIndex = -1;
      await setSource(await audio().decodeAudioData(await file.arrayBuffer()), file.name);
    } catch (e) {
      status = `couldn't decode ${file.name}`;
    }
  }

  async function toggleRecord() {
    const c = audio();
    if (rec) { await rec.stop(); return; }
    try {
      stopBeat();
      const r = await startRecording(c, { maxSec: 15, voiceProcessing });
      rec = r;
      const t0 = performance.now();
      const iv = setInterval(() => {
        recLeft = Math.max(0, 15 - (performance.now() - t0) / 1000);
        recLevel = r.level();
      }, 50);
      const buf = await r.finished;
      clearInterval(iv);
      rec = null;
      recLevel = 0;
      refIndex = -1;
      await setSource(buf, `mic ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      rec = null;
      status = `mic unavailable: ${(e as Error).message}`;
    }
  }

  let fullSrc: AudioBufferSourceNode | null = null;
  function playFull() {
    if (!buffer) return;
    fullSrc?.stop();
    const c = audio();
    fullSrc = c.createBufferSource();
    fullSrc.buffer = buffer;
    fullSrc.connect(c.destination);
    fullSrc.start();
  }

  function auditionSlice(m: SliceMethod, i: number) {
    const s = results?.[m].slices[i];
    if (!s || !buffer) return;
    playSlice(audio(), buffer, s);
    lanes[m]?.flash(i);
  }

  /** play the 3 slices that best fit a drum role */
  function playRole(role: (typeof DRUM_ROLES)[number]) {
    const r = results?.[tableMethod];
    if (!r || !buffer || !roles.length) return;
    const c = audio();
    const best = roles.map((sc, i) => ({ i, v: sc[role] })).sort((a, b) => b.v - a.v).slice(0, 3);
    let t = c.currentTime + 0.05;
    for (const { i } of best) {
      const s = r.slices[i];
      playSlice(c, buffer, s, t);
      setTimeout(() => lanes[tableMethod]?.flash(i), (t - c.currentTime) * 1000);
      t += Math.min(0.5, s.end - s.start) + 0.25;
    }
  }

  function playInOrder(m: SliceMethod) {
    const r = results?.[m];
    if (!r || !buffer) return;
    const c = audio();
    let t = c.currentTime + 0.05;
    r.slices.forEach((s, i) => {
      playSlice(c, buffer!, s, t);
      setTimeout(() => lanes[m]?.flash(i), (t - c.currentTime) * 1000);
      t += s.end - s.start + 0.15;
    });
  }

  function syncBeatView() {
    if (!beat) return;
    steps = beat.voices.map((v) => [...v.pattern]);
    voiceSlices = beat.voices.map((v) => v.slice);
  }

  function startBeat(m: SliceMethod = beatMethod) {
    const r = results?.[m];
    if (!r || !buffer || !r.slices.length) return;
    stopBeat();
    beatMethod = m;
    beat = new BeatPreview(audio(), buffer, r.slices, voiceCount, (h) => {
      lanes[beatMethod]?.flash(h.slice);
      stepNow = h.step;
    });
    beat.bpm = bpm;
    syncBeatView();
    beat.start();
    playing = true;
  }

  function stopBeat() {
    beat?.dispose();
    beat = null;
    playing = false;
    stepNow = -1;
  }

  function newBeat() { if (beat) { beat.newBeat(); syncBeatView(); } else startBeat(); }
  function evolve() { beat?.evolve(); syncBeatView(); }
  $effect(() => { if (beat) beat.bpm = bpm; });
  $effect(() => { const n = voiceCount; if (beat) { beat.setVoiceCount(n); syncBeatView(); } });

  function vote(m: SliceMethod) {
    if (!currentKey) return;
    votes[currentKey] = m;
  }

  function exportVotes() {
    const blob = new Blob([JSON.stringify({ params: $state.snapshot(params), votes: $state.snapshot(votes) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'beatvox-slicer-votes.json';
    a.click();
  }

  function onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowright' || k === 'n') loadRef(refIndex + 1);
    else if (k === 'arrowleft' || k === 'p') loadRef(refIndex - 1);
    else if (k === ' ') { e.preventDefault(); playing ? stopBeat() : startBeat(); }
    else if (k === 'r') loadRef(Math.floor(Math.random() * refs.length));
    else if (k === 'e') evolve();
    else if (k === 'b') newBeat();
    else if (k === 'f') playFull();
    else if (k === '1') vote('attacks');
    else if (k === '2') vote('syllables');
    else if (k === '3') vote('mixed');
  }

  onMount(async () => {
    try {
      refs = await (await fetch('/__ref/list')).json();
      const first = refs.findIndex((r) => r.group === '2008 visitors');
      if (first >= 0) await loadRef(first);
    } catch {
      status = 'no reference recordings (dev server only) — drop a file or record';
    }
  });

  type ParamDef = { key: keyof SliceParams; label: string; min: number; max: number; step: number; unit?: string };
  const COMMON: ParamDef[] = [
    { key: 'floorDb', label: 'floor', min: -70, max: -10, step: 1, unit: 'dB' },
    { key: 'minLenMs', label: 'min length', min: 20, max: 300, step: 5, unit: 'ms' },
    { key: 'maxLenMs', label: 'max length', min: 200, max: 3000, step: 50, unit: 'ms' },
    { key: 'prerollMs', label: 'pre-roll', min: 0, max: 60, step: 1, unit: 'ms' },
  ];
  const BY_METHOD: Record<SliceMethod, ParamDef[]> = {
    attacks: [
      { key: 'attackSensitivity', label: 'sensitivity', min: 0, max: 1, step: 0.01 },
      { key: 'attackMinGapMs', label: 'min gap', min: 20, max: 400, step: 5, unit: 'ms' },
    ],
    syllables: [
      { key: 'syllableSmoothMs', label: 'smoothing', min: 5, max: 120, step: 1, unit: 'ms' },
      { key: 'syllableDipDb', label: 'dip depth', min: 0.5, max: 15, step: 0.5, unit: 'dB' },
      { key: 'syllableMinGapMs', label: 'min gap', min: 30, max: 400, step: 5, unit: 'ms' },
    ],
    mixed: [{ key: 'mixedSplitStrength', label: 'split strength', min: 0, max: 1, step: 0.01 }],
  };
  const fmt = (v: number, d: ParamDef) => (d.step < 1 ? v.toFixed(2) : String(v)) + (d.unit ? ' ' + d.unit : '');
</script>

<svelte:window onkeydown={onKey} />

<div
  class="page"
  role="application"
  ondragover={(e) => e.preventDefault()}
  ondrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f) loadFile(f); }}
>
  <header>
    <h1>BEAT VOX</h1>
    <div class="beatbox" aria-hidden="true">
      {#each Array(STEPS) as _, i}
        <span class="led" class:on={i === stepNow}></span>
      {/each}
    </div>
    <div class="tag">slicer lab · <span>putting rhythm into your voice…</span></div>
  </header>

  <main>
    <section class="panel source">
      <h2>Source</h2>
      <div class="row">
        <select
          value={refIndex}
          onchange={(e) => loadRef(+(e.currentTarget as HTMLSelectElement).value)}
          aria-label="Reference recording"
        >
          <option value={-1} disabled>{refs.length ? 'choose a recording…' : 'no reference recordings'}</option>
          {#each refs as r, i}
            <option value={i}>{r.group} — {r.name}</option>
          {/each}
        </select>
        <button class="pill" onclick={() => loadRef(refIndex - 1)} title="previous (←)">◀</button>
        <button class="pill" onclick={() => loadRef(refIndex + 1)} title="next (→)">▶</button>
        <button class="pill" onclick={() => loadRef(Math.floor(Math.random() * refs.length))} title="random (R)">random</button>
      </div>
      <div class="row">
        <button class="pill rec" class:live={rec} onclick={toggleRecord}>
          {rec ? `STOP ${recLeft.toFixed(0)}` : 'RECORD'}
        </button>
        {#if rec}<span class="meter"><span style="width:{Math.min(100, recLevel * 100)}%"></span></span>{/if}
        <label class="check"><input type="checkbox" bind:checked={voiceProcessing} /> noisy room</label>
        <label class="pill file">open file<input type="file" accept="audio/*" onchange={(e) => { const f = (e.currentTarget as HTMLInputElement).files?.[0]; if (f) loadFile(f); }} /></label>
        <button class="pill" onclick={playFull} disabled={!buffer} title="F">PLAY</button>
      </div>
      <div class="status"><b>{sourceName || '—'}</b> {status}</div>
    </section>

    <section class="lanes">
      {#if results && mono && buffer}
        {#each METHODS as m}
          <div class="lanebox">
            <Lane
              bind:this={lanes[m]}
              label={INFO[m].label}
              hint={INFO[m].hint}
              {mono}
              sampleRate={buffer.sampleRate}
              result={results[m]}
              {showCurve}
              active={playing && beatMethod === m}
              onslice={(i) => auditionSlice(m, i)}
            />
            <div class="lanebtns">
              <button class="pill" onclick={() => playInOrder(m)}>slices in order</button>
              <button class="pill" class:on={playing && beatMethod === m} onclick={() => (playing && beatMethod === m ? stopBeat() : startBeat(m))}>
                {playing && beatMethod === m ? 'stop beat' : 'beat'}
              </button>
              <button class="pill vote" class:on={votes[currentKey] === m} onclick={() => vote(m)} title="press {METHODS.indexOf(m) + 1}">
                {votes[currentKey] === m ? '★ best' : '☆ best'}
              </button>
            </div>
          </div>
        {/each}
        <label class="check"><input type="checkbox" bind:checked={showCurve} /> show detection curve</label>
      {:else}
        <div class="empty">Load a reference recording, drop an audio file here, or RECORD.</div>
      {/if}
    </section>

    <section class="panel beat">
      <h2>Beat preview</h2>
      <div class="transport">
        <button class="ring go" onclick={() => startBeat()} disabled={!results}>GO!</button>
        <button class="ring stop" onclick={stopBeat}>STOP</button>
        <div class="modify">
          <button class="ring blue" onclick={newBeat} disabled={!results} aria-label="New Beat"></button><span>New Beat</span>
          <button class="ring blue" onclick={evolve} disabled={!playing} aria-label="Evolve"></button><span>Evolve</span>
        </div>
      </div>
      <div class="sliders">
        <label>tempo <input type="range" min="60" max="160" bind:value={bpm} /> <output>{bpm}</output></label>
        <label>voices <input type="range" min="1" max="8" bind:value={voiceCount} /> <output>{voiceCount}</output></label>
        <label>slices from
          <select bind:value={beatMethod} onchange={() => playing && startBeat(beatMethod)}>
            {#each METHODS as m}<option value={m}>{INFO[m].label}</option>{/each}
          </select>
        </label>
      </div>
      {#if steps.length}
        <div class="grid" role="grid" aria-label="Pattern">
          {#each steps as row, v}
            <div class="gridrow">
              <span class="vlabel">v{v + 1}·s{voiceSlices[v] + 1}</span>
              {#each row as on, s}
                <span class="cell" class:on class:now={s === stepNow} class:gap={s % 4 === 0}>{on ? '×' : ''}</span>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="panel params">
      <h2>Slicing parameters</h2>
      <fieldset>
        <legend>all methods</legend>
        {#each COMMON as d}
          <label>{d.label}
            <input type="range" min={d.min} max={d.max} step={d.step} bind:value={params[d.key]} />
            <output>{fmt(params[d.key], d)}</output>
          </label>
        {/each}
      </fieldset>
      {#each METHODS as m}
        <fieldset>
          <legend>{INFO[m].label.toLowerCase()}</legend>
          {#each BY_METHOD[m] as d}
            <label>{d.label}
              <input type="range" min={d.min} max={d.max} step={d.step} bind:value={params[d.key]} />
              <output>{fmt(params[d.key], d)}</output>
            </label>
          {/each}
          {#if m === 'mixed'}<small>also uses the attacks and syllables settings</small>{/if}
        </fieldset>
      {/each}
      <button class="pill" onclick={() => (params = { ...DEFAULT_PARAMS })}>reset defaults</button>
    </section>

    <section class="panel votes">
      <h2>Your picks</h2>
      <p>Mark the best method for each recording (★ or keys 1/2/3). Tally across {Object.keys(votes).length} recordings:</p>
      <div class="tally">
        {#each METHODS as m}<span><b>{INFO[m].label}</b> {tally[m]}</span>{/each}
      </div>
      <button class="pill" onclick={exportVotes}>export picks + settings</button>
      <p class="keys">keys: ←/→ or P/N prev/next · R random · F play full · space beat · B new beat · E evolve</p>
    </section>

    <section class="panel table">
      <h2>Slices
        <select bind:value={tableMethod}>
          {#each METHODS as m}<option value={m}>{INFO[m].label}</option>{/each}
        </select>
        <label class="check"><input type="checkbox" bind:checked={sortByPitch} /> sort by pitch</label>
        <label class="check"><input type="checkbox" bind:checked={sortByRole} /> sort by role</label>
      </h2>
      <div class="row roles">
        <span>best 3:</span>
        {#each DRUM_ROLES as role (role)}
          <button class="pill" disabled={!roles.length} onclick={() => playRole(role)}>{role}</button>
        {/each}
      </div>
      <div class="scroll">
        <table>
          <thead><tr><th>#</th><th>start</th><th>length</th><th>level</th><th>pitch</th><th>voiced</th><th>role</th></tr></thead>
          <tbody>
            {#each tableRows as row (row.i)}
              <tr onclick={() => auditionSlice(tableMethod, row.i)}>
                <td>{row.i + 1}</td>
                <td>{row.s.start.toFixed(2)} s</td>
                <td>{Math.round((row.s.end - row.s.start) * 1000)} ms</td>
                <td>{row.s.peakDb.toFixed(0)} dB</td>
                <td>{row.p?.hz ? `${noteName(row.p.hz)} · ${row.p.hz.toFixed(0)} Hz` : '—'}</td>
                <td>{row.p ? Math.round(row.p.voiced * 100) + '%' : ''}</td>
                <td>{row.role ? `${row.role} ${Math.round(row.score * 100)}` : ''}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #fff;
    color: #111;
    font: 13px/1.35 Arial, Helvetica, sans-serif;
  }
  .page { max-width: 1280px; margin: 0 auto; padding: 8px 16px 40px; }
  header {
    display: flex;
    align-items: end;
    gap: 16px;
    flex-wrap: wrap;
    border-bottom: 1px solid #333;
    padding-bottom: 4px;
  }
  h1 {
    font: normal 40px/1 'Courier New', Courier, monospace;
    letter-spacing: 2px;
    margin: 0;
  }
  .beatbox { display: flex; gap: 2px; margin-bottom: 6px; }
  .led {
    width: 11px; height: 11px;
    border: 1px solid #555;
    background: #fff;
  }
  .led:nth-child(4n + 1) { margin-left: 5px; }
  .led.on { background: #f3d23a; }
  .tag { margin-left: auto; color: #333; }
  .tag span { font-style: italic; }
  main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 12px;
    margin-top: 12px;
    align-items: start;
  }
  .source, .lanes { grid-column: 1; }
  .beat, .params, .votes, .table { grid-column: 2; }
  .lanes { grid-row: 2 / span 4; display: flex; flex-direction: column; gap: 10px; }
  .source { grid-row: 1; }
  .beat { grid-row: 1 / span 2; }
  @media (max-width: 900px) {
    main { grid-template-columns: minmax(0, 1fr); }
    .source, .lanes, .beat, .params, .votes, .table { grid-column: 1; grid-row: auto; }
  }
  .panel {
    background: #c3d5e4;
    border: 1px solid #7a8a99;
    border-radius: 8px;
    padding: 8px 12px 12px;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 14px;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 6px; }
  .row select { flex: 1 1 240px; min-width: 0; }
  .status { font-size: 12px; color: #234; }
  .pill {
    border: 1px solid #777;
    border-radius: 999px;
    background: linear-gradient(#f4f4f4, #c9c9c9);
    padding: 4px 12px;
    font: bold 12px Arial, sans-serif;
    cursor: pointer;
    color: #111;
  }
  .pill:active, .pill.on { background: linear-gradient(#cfe9cf, #9fd09f); }
  .pill:disabled { opacity: 0.5; cursor: default; }
  .pill.rec { font-size: 14px; padding: 6px 18px; }
  .pill.rec.live { background: linear-gradient(#ff8a8a, #e04040); color: #fff; }
  .pill.vote.on { background: linear-gradient(#fff3b0, #f0d35a); }
  .file { position: relative; overflow: hidden; }
  .file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .check { display: inline-flex; gap: 4px; align-items: center; font-size: 12px; font-weight: normal; }
  .meter { width: 120px; height: 10px; border: 1px solid #333; background: #333; }
  .meter span { display: block; height: 100%; background: #6f6; }
  .lanebox { display: flex; flex-direction: column; gap: 4px; }
  .lanebtns { display: flex; gap: 6px; flex-wrap: wrap; }
  .empty {
    border: 2px dashed #8aa;
    border-radius: 8px;
    padding: 40px 16px;
    text-align: center;
    color: #456;
  }
  .transport { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .ring {
    width: 44px; height: 44px;
    border-radius: 50%;
    background: #fff;
    border: 5px solid;
    font: bold 10px Arial, sans-serif;
    cursor: pointer;
    box-shadow: 0 0 0 4px #d8d8d8;
    flex: none;
  }
  .ring:disabled { opacity: 0.45; cursor: default; }
  .ring:active { background: #eef; }
  .go { border-color: #2fd12f; }
  .stop { border-color: #e22; }
  .blue { border-color: #2233dd; }
  .modify {
    display: flex; align-items: center; gap: 8px;
    background: #fdf3a0;
    border: 1px solid #b9a94a;
    border-radius: 8px;
    padding: 6px 10px;
    font-weight: bold;
    font-size: 12px;
  }
  .sliders { display: grid; gap: 4px; margin: 10px 0; }
  .sliders label, fieldset label {
    display: grid;
    grid-template-columns: 90px minmax(0, 1fr) 64px;
    gap: 6px;
    align-items: center;
  }
  output {
    font-family: 'Courier New', monospace;
    background: #fff;
    border: 1px solid #888;
    padding: 0 3px;
    font-size: 11px;
    text-align: right;
  }
  .grid { display: flex; flex-direction: column; gap: 2px; overflow-x: auto; }
  .gridrow { display: flex; gap: 2px; align-items: center; }
  .vlabel { width: 52px; font: 10px 'Courier New', monospace; flex: none; }
  .cell {
    width: 13px; height: 13px;
    border: 1px solid #555;
    background: #fff;
    font: 11px/12px Arial;
    text-align: center;
    flex: none;
  }
  .cell.gap { margin-left: 4px; }
  .cell.now { background: #f3d23a; }
  fieldset {
    border: 1px solid #8a9aa9;
    border-radius: 6px;
    margin: 0 0 8px;
    padding: 4px 8px 6px;
    display: grid;
    gap: 3px;
  }
  legend { font-weight: bold; font-size: 12px; }
  small { color: #456; }
  .tally { display: flex; gap: 14px; margin: 6px 0 8px; }
  .keys { font-size: 11px; color: #456; margin-bottom: 0; }
  .scroll { max-height: 320px; overflow: auto; background: #fff; border: 1px solid #888; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { padding: 2px 6px; text-align: left; border-bottom: 1px solid #e3e3e3; white-space: nowrap; }
  th { position: sticky; top: 0; background: #e6e6e6; }
  tbody tr { cursor: pointer; }
  tbody tr:hover { background: #fdf3a0; }
  input[type='range'] { width: 100%; }
</style>
