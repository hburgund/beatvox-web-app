<script lang="ts">
  // The video sheet: this BeatVox's video, made again here, in the shape
  // picked (square for feeds, tall for Stories and Reels), to share or save.
  // Making starts when it opens and stops when it closes.
  import { drawFrame } from '../lib/video/draw';
  import type { Shape } from '../lib/video/draw';
  import type { ShareVideo } from './video.svelte';

  let { v, open = $bindable() }: { v: ShareVideo; open: boolean } = $props();

  let dlg: HTMLDialogElement;
  let canvas = $state<HTMLCanvasElement>();
  let poster = $state('');
  const made = $derived(v.videos[v.shape]);
  const ok = $derived(v.ok[v.shape]);
  const pct = $derived(Math.round(v.progress[v.shape] * 100));
  const shareSheet = $derived(v.canShare());
  const SHAPE_TEXT: Record<Shape, [string, string]> = { square: ['SQUARE', 'feeds and posts'], tall: ['TALL', 'Stories, Reels, TikTok'] };

  $effect(() => {
    if (open && !dlg.open) {
      dlg.showModal();
      void v.make();
    } else if (!open && dlg.open) {
      v.stop();
      dlg.close();
    }
  });

  // a still from the beat's second bar, a few steps in, while it's made
  $effect(() => {
    const sc = v.script;
    const c = canvas;
    const shape = v.shape;
    if (!sc || !c) return;
    const draw = () => {
      drawFrame(c.getContext('2d')!, sc, v.sprout, sc.beatAt + sc.step * 18.2, shape);
      poster = c.toDataURL('image/jpeg', 0.85);
    };
    draw();
    void document.fonts.load(`700 30px 'Courier Prime'`).then(draw);
  });

  function pick(sh: Shape) {
    v.shape = sh;
    void v.make();
  }
</script>

<dialog bind:this={dlg} class="sheet" aria-label="Make the video" onclose={() => (open = false)}>
  <div class="head">
    <div>
      <p class="label title">THE VIDEO</p>
      <p class="sub">made in this browser, to post anywhere</p>
    </div>
    <button class="btn icon" aria-label="Close" onclick={() => (open = false)}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2.4" /></svg>
    </button>
  </div>

  <div class="body">
    <div class="box {v.shape}">
      <canvas bind:this={canvas} width="540" height={v.shape === 'tall' ? 960 : 540} class:hidden={!!made || !v.script} aria-hidden="true"></canvas>
      {#if made}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video src={made.url} {poster} controls playsinline preload="metadata"></video>
      {:else}
        <div class="making" aria-live="polite">
          {#if v.error}
            <span>{v.error}</span>
          {:else if ok === false}
            <span>This browser can't make the {v.shape} video. Try Chrome or Safari.</span>
          {:else if v.loading || !v.script}
            <span>GETTING THE SOUNDS…</span>
          {:else}
            <span>MAKING THE VIDEO… {pct}%</span>
            <span class="bar"><span style="width: {pct}%"></span></span>
          {/if}
        </div>
      {/if}
    </div>

    <div class="shapes" role="radiogroup" aria-label="Video shape">
      {#each ['square', 'tall'] as const as sh (sh)}
        <button class="shape" class:on={v.shape === sh} role="radio" aria-checked={v.shape === sh} onclick={() => pick(sh)}>
          <span class="glyph {sh}" aria-hidden="true"></span>
          <span><b>{SHAPE_TEXT[sh][0]}</b><span class="meta">{SHAPE_TEXT[sh][1]}</span></span>
        </button>
      {/each}
    </div>

    <button class="btn primary send" disabled={!made} onclick={() => v.share()}>{shareSheet ? 'SHARE VIDEO…' : 'SAVE VIDEO'}</button>
    <p class="meta" aria-live="polite">
      {#if v.captionCopied}Caption copied: paste it in your post.{:else}We copy a caption with this beat’s link too, to paste in your post.{/if}
    </p>
    {#if shareSheet}
      <button class="link" disabled={!made} onclick={() => v.save()}>Save it to this device</button>
    {/if}
  </div>
</dialog>

<style>
  .sheet {
    width: 100%;
    max-width: 560px;
    max-height: calc(100dvh - 32px);
    margin: auto auto 0;
    padding: 0;
    border: none;
    border-top: 2px solid var(--ink);
    border-radius: 14px 14px 0 0;
    background: var(--paper);
    color: var(--ink);
    display: none;
    flex-direction: column;
    overflow: hidden;
    transition:
      transform 260ms ease,
      display 260ms allow-discrete,
      overlay 260ms allow-discrete;
    transform: translateY(100%);
  }
  .sheet[open] {
    display: flex;
    transform: translateY(0);
  }
  @starting-style {
    .sheet[open] {
      transform: translateY(100%);
    }
  }
  .sheet::backdrop {
    background: rgb(29 27 22 / 0.45);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 16px 10px;
    border-bottom: 2px solid var(--ink);
  }
  .title {
    font-size: 16px;
    letter-spacing: 0.06em;
  }
  p {
    margin: 0;
  }
  .sub,
  .meta {
    font: 13px/1.35 var(--sans);
    color: var(--muted);
  }
  .btn.icon {
    width: 44px;
    padding: 0;
    flex: none;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 16px calc(18px + env(safe-area-inset-bottom));
    overflow-y: auto;
  }
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
    width: min(100%, 300px, calc(100dvh - 400px));
    min-width: 180px;
    aspect-ratio: 1;
  }
  .box.tall {
    width: min(100%, 196px, calc((100dvh - 400px) * 9 / 16));
    min-width: 120px;
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
  .shapes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .shape {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    padding: 6px 10px;
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    background: var(--card);
    color: var(--ink);
    font: 13px/1.25 var(--mono);
    text-align: left;
    cursor: pointer;
  }
  .shape.on {
    background: var(--yellow);
    box-shadow: 3px 3px 0 var(--ink);
  }
  .shape b,
  .shape .meta {
    display: block;
  }
  .shape .meta {
    font-size: 11.5px;
  }
  .glyph {
    flex: none;
    border: 2px solid var(--ink);
    border-radius: 3px;
    background: var(--paper);
  }
  .glyph.square {
    width: 20px;
    height: 20px;
  }
  .glyph.tall {
    width: 14px;
    height: 24px;
  }
  .send {
    min-height: 52px;
    font-size: 16px;
  }
  .link {
    align-self: center;
    border: none;
    background: none;
    padding: 4px;
    color: var(--ink);
    font: 600 14px var(--sans);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .link:disabled {
    color: var(--muted);
    cursor: default;
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet {
      transition: none;
    }
  }
</style>
