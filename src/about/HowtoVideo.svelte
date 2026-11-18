<script lang="ts">
  // The how-to video in an overlay, in the shape that fits the screen
  // (chosen when it opens). Over everything, About included; Esc, the close
  // button or a tap outside the video closes it.
  import { howto, howtoShape, HOWTO_VIDEOS } from './howto.svelte';

  let dlg: HTMLDialogElement;
  let video = $state<HTMLVideoElement>();
  let shape = $state(howtoShape(innerWidth, innerHeight));
  const v = $derived(HOWTO_VIDEOS[shape]);

  $effect(() => {
    if (howto.open && !dlg.open) {
      shape = howtoShape(innerWidth, innerHeight);
      dlg.showModal();
      // opened by a tap, so it may start with sound
      requestAnimationFrame(() => {
        if (!video) return;
        video.currentTime = 0;
        void video.play().catch(() => {});
      });
    } else if (!howto.open && dlg.open) {
      video?.pause();
      dlg.close();
    }
  });
</script>

<dialog
  bind:this={dlg}
  class="howto"
  aria-label="How to use BeatVox (video)"
  oncancel={(e) => {
    e.preventDefault();
    howto.hide();
  }}
  onclick={(e) => {
    // a tap outside the video closes it
    if (e.target === dlg) howto.hide();
  }}
>
  <div class="box" style="--r: {v.w / v.h}; aspect-ratio: {v.w} / {v.h}">
    <div class="frame">
      <!-- svelte-ignore a11y_media_has_caption (the video's words are on screen) -->
      <video bind:this={video} src={v.src} poster={v.poster} controls playsinline preload="none"></video>
    </div>
    <button class="btn close" aria-label="Close the video" onclick={() => howto.hide()}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2.4" /></svg>
    </button>
  </div>
</dialog>

<style>
  .howto {
    width: 100vw;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .howto:not([open]) {
    display: none;
  }
  .howto::backdrop {
    background: rgb(29 27 22 / 0.75);
  }
  /* as big as fits, with room round it for the close button */
  .box {
    position: relative;
    width: min(calc(100vw - 32px), calc((100dvh - 96px) * var(--r, 1)));
    max-height: calc(100dvh - 96px);
    margin-top: 40px;
  }
  .frame {
    width: 100%;
    height: 100%;
    border: 2px solid var(--ink);
    border-radius: 10px;
    box-shadow: 6px 6px 0 var(--ink);
    background: var(--paper);
    overflow: hidden;
  }
  video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: var(--paper);
  }
  /* just above the video's top right corner, clear of it */
  .close {
    position: absolute;
    top: -54px;
    right: -2px;
    width: 44px;
    padding: 0;
  }
</style>
