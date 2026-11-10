<script lang="ts">
  // Dev only, for now: the BeatVox video drawn live over its soundtrack (the
  // saved "voice, then the beat"), so the sprouts can be judged with sound.
  // Each video gets a sprout at random (as opening this does); try the others
  // with the buttons. Play, scrub. Nothing is encoded or saved.
  import { onDestroy } from 'svelte';
  import { buildScript, type VideoScript } from '../lib/video/script';
  import { drawFrame, pickSprout, SPROUTS, SPROUT_NAMES, type Sprout } from '../lib/video/draw';
  import type { Session } from './session.svelte';

  let { s, open, onclose }: { s: Session; open: boolean; onclose: () => void } = $props();

  let dlg: HTMLDialogElement;
  let canvas: HTMLCanvasElement;
  let sprout = $state<Sprout>(pickSprout());
  let t = $state(0);
  let playing = $state(false);
  let script = $state.raw<VideoScript | null>(null);
  let src: AudioBufferSourceNode | null = null;
  let t0 = 0;
  let raf = 0;

  $effect(() => {
    if (open && !dlg.open) {
      const r = s.shareResult;
      if (!r) return;
      script = buildScript(
        { fullAudio: r.fullAudio, remixAt: r.remixAt, tape: r.tape, voiceSpan: r.voiceSpan, slices: r.instrument.slices },
        s.shareTitle.trim() || 'Untitled',
      );
      t = 0;
      sprout = pickSprout();
      dlg.showModal();
      void document.fonts.load(`700 30px 'Courier Prime'`).then(draw);
    } else if (!open && dlg.open) {
      stop();
      dlg.close();
    }
  });

  // redraw on a new sprout or a scrub
  $effect(() => {
    void sprout;
    void t;
    if (!playing) draw();
  });

  function draw() {
    if (!script || !canvas) return;
    drawFrame(canvas.getContext('2d')!, script, sprout, t);
  }

  function play(from = t >= (script?.length ?? 0) - 0.05 ? 0 : t) {
    const r = s.shareResult;
    if (!r || !script) return;
    stop();
    const ctx = s.audio();
    void ctx.resume();
    src = ctx.createBufferSource();
    src.buffer = r.fullAudio;
    src.connect(ctx.destination);
    // a little ahead, so the first frame and the first sound agree
    const at = ctx.currentTime + 0.05;
    if (from < r.fullAudio.duration) src.start(at, from);
    t0 = at - from;
    playing = true;
    const tick = () => {
      t = Math.min(script!.length, ctx.currentTime - t0);
      drawFrame(canvas.getContext('2d')!, script!, sprout, Math.max(0, t));
      if (t >= script!.length) return stop();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(raf);
    try {
      src?.stop();
    } catch {
      /* not started */
    }
    src = null;
    playing = false;
  }

  function scrub(e: Event) {
    const v = Number((e.currentTarget as HTMLInputElement).value);
    if (playing) play(v);
    else t = v;
  }

  onDestroy(stop);
</script>

<dialog
  bind:this={dlg}
  aria-labelledby="vp-title"
  oncancel={(e) => {
    e.preventDefault();
    onclose();
  }}
>
  <header>
    <h2 id="vp-title">VIDEO PREVIEW <span class="dev">dev</span></h2>
    <button class="btn small" onclick={onclose}>CLOSE</button>
  </header>
  <canvas bind:this={canvas} width="1080" height="1080" aria-label="The video, {SPROUT_NAMES[sprout]}"></canvas>
  <div class="sprouts" role="group" aria-label="Sprout">
    {#each SPROUTS as sp (sp)}
      <button class="btn small" class:on={sp === sprout} aria-pressed={sp === sprout} onclick={() => (sprout = sp)}>{SPROUT_NAMES[sp].toUpperCase()}</button>
    {/each}
  </div>
  <div class="transport">
    <button class="btn primary" onclick={() => (playing ? stop() : play())}>{playing ? 'STOP' : 'PLAY'}</button>
    <input type="range" min="0" max={script?.length ?? 1} step="0.01" value={t} oninput={scrub} aria-label="Time" />
    <span class="time">{t.toFixed(1)} / {(script?.length ?? 0).toFixed(1)} s</span>
  </div>
</dialog>

<style>
  dialog {
    width: min(560px, calc(100vw - 24px));
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 8px;
    background: var(--card);
    color: var(--ink);
    padding: 14px;
    font: 14px/1.35 var(--mono);
  }
  dialog::backdrop {
    background: rgba(20, 18, 14, 0.55);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
  }
  .dev {
    font-size: 11px;
    color: var(--muted);
  }
  canvas {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border: 2px solid var(--ink);
    border-radius: 6px;
  }
  .sprouts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
  }
  .btn.small {
    min-height: 40px;
    min-width: 40px;
    padding: 0 10px;
    font-size: 13px;
  }
  .btn.on {
    background: var(--yellow);
  }
  .transport {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
  }
  .transport input {
    flex: 1;
    min-width: 0;
  }
  .time {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
</style>
