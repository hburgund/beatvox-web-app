<script lang="ts">
  // The share sheet: rises from the bottom once the bars are saved. Two
  // steps: put it on the BeatVox map (or skip that), then share it: the
  // video (square or tall), the link, or save the files. The beat stops; the
  // saved loop waits for its play button.
  import PlacePicker from './PlacePicker.svelte';
  import SendDialog from './SendDialog.svelte';
  import VideoBox from './VideoBox.svelte';
  import Check from '../lib/ui/Check.svelte';
  import { mapUrl } from '../lib/roundware';
  import type { Shape } from '../lib/video/draw';
  import type { Session } from './session.svelte';

  let { s, open, onclose }: { s: Session; open: boolean; onclose: () => void } = $props();

  let dlg: HTMLDialogElement;
  let closing = $state(false);
  let popup = $state(false);
  let linkNote = $state('');

  const r = $derived(s.shareResult);
  const canSend = $derived(!!s.place && s.agreed && !!s.project && s.send === 'idle');
  const sent = $derived(s.send === 'sent' && !!s.sentMix);
  const ready = $derived(!!s.videos[s.videoShape]);
  const shareSheet = $derived(s.canShareVideo());
  const SHAPE_TEXT: Record<Shape, [string, string]> = { square: ['SQUARE', 'feeds and posts'], tall: ['TALL', 'Stories, Reels, TikTok'] };

  $effect(() => {
    if (open && !dlg.open) {
      closing = false;
      dlg.showModal();
      s.stopBeat();
      void s.loadProject();
    } else if (!open && dlg.open) {
      // slide down, then close
      closing = true;
      stopAll();
      setTimeout(() => {
        dlg.close();
        closing = false;
      }, 260);
    }
  });

  // the share card, redrawn a moment after the name stops changing
  $effect(() => {
    if (!open || !s.shareResult) return;
    void s.shareTitle;
    const t = setTimeout(() => void s.cardGif().catch(() => {}), s.card ? 700 : 0);
    return () => clearTimeout(t);
  });

  // once it's on the map, on to sharing
  $effect(() => {
    if (s.send === 'sent' && popup) {
      popup = false;
      s.shareStage = 'share';
    }
  });

  // both videos start as soon as there's something to share
  $effect(() => {
    if (open && s.shareResult && s.shareStage === 'share') {
      void s.shareTitle;
      s.makeVideos();
    }
  });

  function stopAll() {
    s.stopLoop();
  }

  function send() {
    popup = true;
    stopAll();
    void s.sendToMap();
  }

  function toShare() {
    stopAll();
    s.shareStatus = '';
    s.shareStage = 'share';
  }

  function another() {
    onclose();
    s.makeAnother();
  }

  async function shareLink() {
    const res = await s.shareLink();
    linkNote = res === 'copied' ? 'Link copied.' : res === 'failed' ? "Couldn't share the link." : '';
  }
</script>

<dialog
  bind:this={dlg}
  class:closing
  aria-labelledby="sheet-title"
  oncancel={(e) => {
    e.preventDefault();
    onclose();
  }}
  onclick={(e) => {
    // a tap on the dimmed backdrop closes the sheet
    if (e.target === dlg) onclose();
  }}
>
  <div class="sheet">
    <div class="grab" aria-hidden="true"></div>
    <header>
      <h2 id="sheet-title">Your BeatVox</h2>
      <button class="btn small" onclick={onclose}>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="square" /></svg>
        STUDIO
      </button>
    </header>

    <ol class="steps" aria-label="Steps">
      <li class="done"><span class="box" aria-hidden="true">✓</span>MAKE IT</li>
      <li class="line" class:done={sent} aria-hidden="true"></li>
      <li class:done={sent} class:now={s.shareStage === 'map'} aria-current={s.shareStage === 'map' ? 'step' : undefined}>
        <span class="box" aria-hidden="true">{sent ? '✓' : '2'}</span>MAP IT
      </li>
      <li class="line" aria-hidden="true"></li>
      <li class:now={s.shareStage === 'share'} aria-current={s.shareStage === 'share' ? 'step' : undefined}><span class="box" aria-hidden="true">3</span>SHARE IT</li>
    </ol>

    {#if r && s.shareStage === 'map'}
      <section class="card loop">
        <button class="btn round" aria-label={s.loopPlaying ? 'Stop the loop' : 'Play the loop'} onclick={() => s.toggleLoop()}>
          {#if s.loopPlaying}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="3" width="12" height="12" fill="currentColor" /></svg>
          {:else}
            <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 2l11 7-11 7z" fill="currentColor" /></svg>
          {/if}
        </button>
        <div>
          <div class="label">THE LOOP</div>
          <div class="meta">{r.loop.loops} bars · {r.loop.duration.toFixed(1)} s, repeating. This is what plays on the BeatVox map.</div>
        </div>
      </section>

      <label class="name">
        <span class="label">NAME IT</span>
        <input type="text" maxlength="60" placeholder="optional" bind:value={s.shareTitle} disabled={s.send !== 'idle'} />
      </label>

      <section class="map">
        <div class="label">PUT IT ON THE BEATVOX MAP</div>
        <p class="meta">Pick a place: where you are, or anywhere on the map.</p>
        {#if open}
          <PlacePicker bind:place={s.place} center={s.project ?? { latitude: 38.33, longitude: -94.93 }} />
        {/if}
        {#if !s.revoxOf}
          <Check bind:checked={s.revoxOk} disabled={s.send !== 'idle'}>Others can reVox my voice (make their own beats with it)</Check>
        {/if}
        <Check bind:checked={s.agreed} disabled={s.send !== 'idle'}>{s.project?.legal_agreement ?? 'Loading the terms…'}</Check>
        <button class="btn primary send" disabled={!canSend} onclick={send}>SEND TO THE MAP</button>
        <p class="meta hint" aria-live="polite">
          {#if !s.place}Choose a place first.{:else if !s.agreed}Tick the terms to send.{/if}
        </p>
        <button class="link skip" onclick={toShare}>Skip the map, just save or share it →</button>
      </section>
    {:else if r}
      {#if sent && s.sentMix}
        <p class="onmap">On the map! BeatVox #{s.sentMix.mixAsset}</p>
      {:else}
        <section class="card nudge">
          <div>
            <div class="strong">Not on the map yet.</div>
            <div class="meta">Put it there and your posts link straight to your beat.</div>
          </div>
          <button class="btn" onclick={() => (s.shareStage = 'map')}>MAP IT</button>
        </section>
      {/if}

      <VideoBox {s} />

      <div class="shapes" role="radiogroup" aria-label="Video shape">
        {#each ['square', 'tall'] as const as sh (sh)}
          <button class="shape" class:on={s.videoShape === sh} role="radio" aria-checked={s.videoShape === sh} onclick={() => (s.videoShape = sh)}>
            <span class="glyph {sh}" aria-hidden="true"></span>
            <span><b>{SHAPE_TEXT[sh][0]}</b><span class="meta">{SHAPE_TEXT[sh][1]}</span></span>
          </button>
        {/each}
      </div>

      <button class="btn primary send" disabled={!ready} onclick={() => s.shareVideo()}>{shareSheet ? 'SHARE VIDEO…' : 'SAVE VIDEO'}</button>
      <p class="meta" aria-live="polite">
        {#if s.captionCopied}Caption copied: paste it in your post.{:else}We copy a caption with {sent ? 'your beat’s link' : 'the BeatVox link'} too, to paste in your post.{/if}
      </p>
      {#if sent}
        <button class="btn" onclick={shareLink}>SHARE THE LINK…</button>
        {#if linkNote}<p class="meta" aria-live="polite">{linkNote}</p>{/if}
      {/if}

      <p class="saves">
        <span class="meta">Save to this device:</span>
        <span class="links"
          ><button class="link" disabled={!ready} onclick={() => s.saveVideo()}>video</button> ·
        <button class="link" onclick={() => s.saveMp3()}>MP3</button> ·
        <button class="link" disabled={!s.card && !s.cardBusy} onclick={() => s.saveGif()}>GIF</button> ·
        <button class="link" onclick={() => s.saveMp3('loop')}>the loop</button></span
        >
      </p>
      {#if s.shareStatus}<p class="error">{s.shareStatus}</p>{/if}

      <div class="after">
        <button class="btn" onclick={another}>MAKE ANOTHER</button>
        <a class="btn" href={mapUrl(s.sentMix?.mixAsset)}>GLOBAL MAP</a>
      </div>
    {/if}
  </div>
  <SendDialog {s} open={popup} onclose={() => (popup = false)} />
</dialog>

<style>
  dialog {
    position: fixed;
    inset: auto 0 0 0;
    margin: 0 auto;
    width: 100%;
    max-width: 560px;
    max-height: calc(100dvh - 40px);
    box-sizing: border-box;
    padding: 0;
    border: 2px solid var(--ink);
    border-bottom: none;
    border-radius: 16px 16px 0 0;
    background: var(--paper);
    color: var(--ink);
    overflow-y: auto;
    overscroll-behavior: contain;
    transition: transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
    transform: translateY(0);
  }
  @starting-style {
    dialog[open] {
      transform: translateY(100%);
    }
  }
  dialog.closing {
    transform: translateY(100%);
    transition-duration: 240ms;
    transition-timing-function: ease-in;
  }
  dialog::backdrop {
    background: rgba(20, 18, 14, 0.42);
  }
  .sheet {
    padding: 8px 16px max(24px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .grab {
    width: 44px;
    height: 5px;
    border-radius: 3px;
    background: var(--soft);
    align-self: center;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    margin: 0;
    font-size: 20px;
  }
  .btn.small {
    min-height: 40px;
    font-size: 13px;
    padding: 0 12px;
  }
  .loop {
    display: flex;
    gap: 12px;
    align-items: center;
    box-shadow: 4px 4px 0 var(--ink);
  }
  .meta {
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }
  .strong {
    font-weight: 700;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .name input {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    background: var(--card);
    padding: 0 10px;
    font: 16px var(--mono);
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: 6px;
    opacity: 0.55;
  }
  .steps li.done,
  .steps li.now {
    opacity: 1;
  }
  .steps .box {
    width: 22px;
    height: 22px;
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 4px;
    background: var(--card);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .steps .now .box {
    background: var(--yellow);
  }
  .steps .done .box {
    background: var(--ink);
    color: var(--card);
  }
  .steps .line {
    flex: 1;
    height: 2px;
    background: var(--soft);
    opacity: 1;
  }
  .steps .line.done {
    background: var(--ink);
  }
  .map {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .send {
    min-height: 52px;
    font-size: 15px;
  }
  .hint {
    min-height: 1.3em;
  }
  .skip {
    align-self: center;
  }
  .onmap {
    margin: 0;
    font-weight: 700;
    font-size: 17px;
  }
  .nudge {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--yellow);
  }
  .nudge > div {
    flex: 1;
  }
  .nudge .meta {
    color: var(--ink);
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
  .saves {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
  }
  .saves .links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 8px;
  }
  .saves .link:disabled {
    opacity: 0.45;
  }
  .after {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    border-top: 2px dashed var(--soft);
    padding-top: 14px;
  }
  .after .btn {
    text-decoration: none;
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .error {
    margin: 0;
    font-size: 13px;
    color: var(--error);
  }
</style>
