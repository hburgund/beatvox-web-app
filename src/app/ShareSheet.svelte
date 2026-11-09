<script lang="ts">
  // The share sheet: rises from the bottom once the bars are saved. The beat
  // stops and the saved loop plays, so you hear what you made. Then save the
  // MP3, share it, or put it on the BeatVox map.
  import PlacePicker from './PlacePicker.svelte';
  import SendDialog from './SendDialog.svelte';
  import Check from '../lib/ui/Check.svelte';
  import type { Session } from './session.svelte';

  let { s, open, onclose }: { s: Session; open: boolean; onclose: () => void } = $props();

  let dlg: HTMLDialogElement;
  let full: HTMLAudioElement | undefined = $state();
  let fullPlaying = $state(false);
  let closing = $state(false);
  let popup = $state(false);

  const r = $derived(s.shareResult);
  const canSend = $derived(!!s.place && s.agreed && !!s.project && s.send === 'idle');
  const canShare = $derived(s.share === 'ready' && s.canShareFile());

  $effect(() => {
    if (open && !dlg.open) {
      closing = false;
      dlg.showModal();
      s.stopBeat();
      void s.loadProject();
      if (!s.loopPlaying) s.toggleLoop();
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

  function stopAll() {
    s.stopLoop();
    full?.pause();
  }

  function toggleLoop() {
    full?.pause();
    s.toggleLoop();
  }

  function toggleFull() {
    if (!full) return;
    if (fullPlaying) return full.pause();
    s.stopLoop();
    full.currentTime = 0;
    void full.play();
  }

  function send() {
    popup = true;
    stopAll();
    void s.sendToMap();
  }

  function another() {
    popup = false;
    onclose();
    s.makeAnother();
  }

  const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
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

    {#if r}
      <section class="card loop">
        <button class="btn round" aria-label={s.loopPlaying ? 'Stop the loop' : 'Play the loop'} onclick={toggleLoop}>
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

      <section class="mp3">
        <div class="line">
          <button class="btn round small-round" aria-label={fullPlaying ? 'Stop' : 'Play your voice, then the beat'} onclick={toggleFull}>
            {#if fullPlaying}
              <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="3" width="12" height="12" fill="currentColor" /></svg>
            {:else}
              <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 2l11 7-11 7z" fill="currentColor" /></svg>
            {/if}
          </button>
          <div>
            <div class="strong">Your voice, then the beat</div>
            <div class="meta">{clock(r.full.duration)} · the MP3 you save and share</div>
          </div>
          <audio bind:this={full} src={r.full.url} preload="auto" onplay={() => (fullPlaying = true)} onpause={() => (fullPlaying = false)} onended={() => (fullPlaying = false)}></audio>
        </div>
        <div class="row">
          <button class="btn" onclick={() => s.saveMp3()}>SAVE MP3</button>
          {#if canShare}<button class="btn" onclick={() => s.shareMp3()}>SHARE…</button>{/if}
        </div>
        <button class="link" onclick={() => s.saveMp3('loop')}>save the loop too</button>
        {#if s.shareStatus}<p class="error">{s.shareStatus}</p>{/if}
      </section>

      <section class="map">
        <div class="label">PUT IT ON THE BEATVOX MAP</div>
        {#if s.send === 'sent' && s.sentMix}
          <p class="done">On the map! Your loop is BeatVox #{s.sentMix.mixAsset}.</p>
          <button class="btn" onclick={() => (popup = true)}>WHAT NEXT?</button>
        {:else}
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
        {/if}
      </section>
    {/if}
  </div>
  <SendDialog {s} open={popup} onclose={() => (popup = false)} onanother={another} />
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
  .mp3 {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .small-round {
    width: 44px;
    height: 44px;
    background: var(--card);
    box-shadow: none;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .row .btn {
    flex: 1;
  }
  .mp3 .link {
    align-self: flex-start;
  }
  .map {
    border-top: 2px dashed var(--soft);
    padding-top: 14px;
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
  .done {
    margin: 0;
    font-weight: 700;
  }
  .error {
    margin: 0;
    font-size: 13px;
    color: var(--error);
  }
</style>
