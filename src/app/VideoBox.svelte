<script lang="ts">
  // The video to share, in the shape picked: a still from it (and how far
  // along it is) while it's being made, then the video itself to play.
  import { buildScript } from '../lib/video/script';
  import { drawFrame, type Shape } from '../lib/video/draw';
  import type { Session } from './session.svelte';

  let { s }: { s: Session } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let poster = $state('');
  const shape = $derived<Shape>(s.videoShape);
  const video = $derived(s.videos[shape]);
  const ok = $derived(s.videoOk[shape]);
  const pct = $derived(Math.round(s.videoProgress[shape] * 100));

  // a still from the beat's second bar, a few steps in
  $effect(() => {
    const r = s.shareResult;
    if (!r || !canvas) return;
    const title = s.shareTitle.trim() || r.recipe.name;
    void shape;
    const sc = buildScript({ fullAudio: r.fullAudio, remixAt: r.remixAt, tape: r.tape, voiceSpan: r.voiceSpan, slices: r.instrument.slices }, title);
    const c = canvas;
    const draw = () => {
      drawFrame(c.getContext('2d')!, sc, r.sprout, sc.beatAt + sc.step * 18.2, shape);
      poster = c.toDataURL('image/jpeg', 0.85);
    };
    draw();
    void document.fonts.load(`700 30px 'Courier Prime'`).then(draw);
  });
</script>

<div class="box {shape}">
  <canvas bind:this={canvas} width="540" height={shape === 'tall' ? 960 : 540} class:hidden={!!video} aria-hidden={!!video}></canvas>
  {#if video}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video src={video.url} {poster} controls playsinline preload="metadata"></video>
  {:else}
    <div class="making" aria-live="polite">
      {#if ok === false}
        <span>This browser can't make the {shape} video. Try Chrome or Safari.</span>
      {:else}
        <span>MAKING THE VIDEO… {pct}%</span>
        <span class="bar"><span style="width: {pct}%"></span></span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .box {
    position: relative;
    align-self: center;
    border: 2px solid var(--ink);
    border-radius: 8px;
    overflow: hidden;
    background: var(--paper);
    box-shadow: 4px 4px 0 var(--ink);
  }
  .box.square {
    width: min(100%, 300px);
    aspect-ratio: 1;
  }
  .box.tall {
    width: min(100%, 196px);
    aspect-ratio: 9 / 16;
  }
  canvas,
  video {
    display: block;
    width: 100%;
    height: 100%;
  }
  canvas.hidden {
    display: none;
  }
  .making {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border: 2px solid var(--ink);
    border-radius: 6px;
    background: var(--card);
    font-size: 12px;
    font-weight: 700;
  }
  .bar {
    height: 6px;
    border: 1.5px solid var(--ink);
    border-radius: 3px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--pink);
    transition: width 200ms;
  }
</style>
