<script lang="ts">
  import { SHARE_LOOPS, type Session } from './session.svelte';
  let { s }: { s: Session } = $props();

  const ready = $derived(s.slices.length > 0);
  const busy = $derived(s.share === 'waiting' || s.share === 'capturing');
  const seconds = $derived(Math.round((SHARE_LOOPS * 16 * 60) / s.bpm / 4));
  const loop = $derived(Math.min(SHARE_LOOPS, Math.floor(s.shareProgress * SHARE_LOOPS) + 1));
  const canShare = $derived(s.share === 'ready' && s.canShareFile());

  const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const kb = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1000)} KB`);

  const message = $derived.by(() => {
    switch (s.share) {
      case 'waiting':
        return 'Starts on the next downbeat…';
      case 'capturing':
        return `Recording loop ${loop} of ${SHARE_LOOPS}. Keep playing!`;
      case 'rendering':
        return 'Mixing your MP3…';
      case 'ready':
        return 'Done! Have a listen.';
      default:
        return `Records ${SHARE_LOOPS} bars (about ${seconds} s) of your beat as a loop that repeats forever.`;
    }
  });
</script>

<section class="share">
  <h2>Make an MP3 of Your Beat</h2>

  {#if !ready}
    <p class="empty">Record your voice first, then make a beat.</p>
  {/if}

  <div class="box">
    <div class="line">
      {#if busy}
        <button class="pill live" onclick={() => s.cancelCapture()}>CANCEL</button>
      {:else}
        <button class="pill" disabled={!ready || s.share === 'rendering'} onclick={() => s.capture()}>
          {s.share === 'ready' ? 'AGAIN' : 'RECORD'}
        </button>
      {/if}
      <span class="hint" aria-live="polite">{message}</span>
    </div>

    <div
      class="meter"
      class:live={busy}
      role="progressbar"
      aria-label="Capture progress"
      aria-valuemin="0"
      aria-valuemax={SHARE_LOOPS}
      aria-valuenow={s.share === 'ready' ? SHARE_LOOPS : busy ? loop - 1 : 0}
    >
      {#each Array(SHARE_LOOPS) as _, i (i)}
        <span
          class="cell"
          class:done={s.share === 'ready' || s.share === 'rendering' || (s.share === 'capturing' && i < loop - 1)}
          class:now={s.share === 'capturing' && i === loop - 1}
        ></span>
      {/each}
    </div>

    {#if busy}
      <p class="tip">You can switch to <button class="link" onclick={() => (s.tab = 'listen')}>Listen</button> and keep changing the beat. Everything you do is in the recording.</p>
    {/if}

    {#if s.share === 'ready' && s.shareResult}
      {@const r = s.shareResult}
      <div class="part">
        <h3>Your BeatVox loop</h3>
        <div class="line">
          <button class="pill" class:on={s.loopPlaying} onclick={() => s.toggleLoop()}>{s.loopPlaying ? 'STOP' : 'PLAY LOOP'}</button>
          <span class="info">{r.loop.loops} bars, {r.loop.duration.toFixed(1)} s, repeating forever. This is what plays on the BeatVox map.</span>
        </div>
      </div>

      <div class="part">
        <h3>Your voice, then the beat</h3>
        <audio controls src={r.full.url} preload="auto"></audio>
        <p class="info">{clock(r.full.duration)} · {kb(r.full.mp3.size)} · the beat starts at {clock(r.remixAt)}</p>
      </div>

      <label class="title">
        <span>Title</span>
        <input type="text" maxlength="60" placeholder="optional" bind:value={s.shareTitle} />
      </label>

      <div class="actions">
        <button class="pill" onclick={() => s.saveMp3()}>SAVE MP3</button>
        {#if canShare}
          <button class="pill" onclick={() => s.shareMp3()}>SHARE…</button>
        {/if}
      </div>
      <p class="file">
        {s.shareFileName()} · <button class="link" onclick={() => s.saveMp3('loop')}>save the loop too</button>
      </p>
    {/if}

    {#if s.shareStatus}<p class="status">{s.shareStatus}</p>{/if}
  </div>

  <p class="later">Sending it to BeatVox on Roundware, with where you made it and the option to let others reVox your voice, comes next.</p>
</section>

<style>
  .share {
    padding: 10px 18px 22px;
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
  .box {
    max-width: 480px;
    margin: 0 auto;
    background: var(--bv-yellow);
    border: 1px solid var(--bv-yellow-edge);
    border-radius: 10px;
    padding: 14px 16px 16px;
    display: grid;
    gap: 12px;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .line .pill {
    min-width: 108px;
    flex: none;
  }
  .hint {
    font: bold 12px Arial, sans-serif;
  }
  .meter {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
    background: #222;
    border-radius: 4px;
    padding: 4px;
  }
  .cell {
    height: 14px;
    border-radius: 2px;
    background: #444;
  }
  .cell.done {
    background: var(--bv-led);
  }
  .cell.now {
    background: var(--bv-red);
    animation: blink 0.7s steps(2) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0.4;
    }
  }
  .tip {
    margin: 0;
    font-size: 12px;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--bv-blue);
    text-decoration: underline;
    font-weight: bold;
    cursor: pointer;
  }
  audio {
    width: 100%;
  }
  .part {
    display: grid;
    gap: 8px;
  }
  h3 {
    margin: 0;
    font-size: 13px;
  }
  .part .info {
    margin: 0;
  }
  .info,
  .file {
    margin: -4px 0 0;
    font-size: 12px;
    color: #333;
  }
  .file {
    font-family: var(--bv-mono);
    font-size: 11px;
    overflow-wrap: anywhere;
    margin: -6px 0 0;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font: bold 12px Arial, sans-serif;
  }
  .title input {
    flex: 1;
    min-width: 0;
    font: 15px Arial, sans-serif;
    border: 1px solid #888;
    border-radius: 4px;
    padding: 5px 8px;
    box-shadow: inset 1px 1px 0 #ccc;
  }
  .actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .status {
    margin: 0;
    color: #a00;
    font-size: 12px;
  }
  .later {
    max-width: 480px;
    margin: 14px auto 0;
    font-size: 12px;
    color: #345;
    text-align: center;
  }
</style>
