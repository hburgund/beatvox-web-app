<script lang="ts">
  // The bar along the bottom: SAVE 8 BARS → the bars filling in as they're
  // saved (keep playing!) → SHARE.
  import { SHARE_LOOPS, type Session } from './session.svelte';

  let { s, onshare }: { s: Session; onshare: () => void } = $props();

  const ready = $derived(s.slices.length > 0);
  const busy = $derived(s.share === 'waiting' || s.share === 'capturing' || s.share === 'rendering');
  const bar = $derived(Math.min(SHARE_LOOPS, Math.floor(s.shareProgress * SHARE_LOOPS) + 1));
  const done = $derived(
    s.share === 'rendering' || s.share === 'ready' ? SHARE_LOOPS : s.share === 'capturing' ? bar - 1 : 0,
  );
  const title = $derived(
    s.share === 'waiting'
      ? 'STARTS ON THE NEXT DOWNBEAT…'
      : s.share === 'capturing'
        ? `SAVING · BAR ${bar} OF ${SHARE_LOOPS}`
        : 'MIXING YOUR LOOP…',
  );
</script>

<div class="bar">
  {#if busy}
    <div class="progress">
      <div class="top">
        <span class="title" aria-live="polite"><span class="dot"></span>{title}</span>
        {#if s.share !== 'rendering'}
          <button class="btn small" onclick={() => s.cancelCapture()}>CANCEL</button>
        {/if}
      </div>
      <div class="meter" role="progressbar" aria-label="Bars saved" aria-valuemin="0" aria-valuemax={SHARE_LOOPS} aria-valuenow={done}>
        {#each Array(SHARE_LOOPS) as _, i (i)}
          <span class:done={i < done} class:now={s.share === 'capturing' && i === bar - 1}></span>
        {/each}
      </div>
    </div>
  {:else if s.share === 'ready'}
    <button class="btn primary" onclick={onshare}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 10l5-5 5 5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="square" /></svg>
      SHARE
    </button>
    <div class="note">
      <span>{SHARE_LOOPS} bars saved.</span>
      <button class="link" onclick={() => s.capture()}>save again</button>
    </div>
  {:else}
    <button class="btn primary" disabled={!ready} onclick={() => s.capture()}><span class="dot"></span>SAVE {SHARE_LOOPS} BARS</button>
    <p class="note">
      {#if s.shareStatus}<span class="error">{s.shareStatus}</span>{:else}Starts on the next downbeat. Keep playing while it saves.{/if}
    </p>
  {/if}
</div>

<style>
  .bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    min-height: var(--bar-h);
    box-sizing: border-box;
    padding: 12px max(16px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    border-top: 2px solid var(--ink);
    background: var(--card);
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .bar > .btn {
    flex: none;
    min-height: 52px;
    padding: 0 16px;
    font-size: 15px;
  }
  .note {
    margin: 0;
    font: 12px/1.35 var(--sans);
    color: var(--muted);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .note .link {
    font: 700 13px var(--mono);
    color: var(--ink);
    min-height: 32px;
  }
  .error {
    color: var(--error);
  }
  .progress {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .title {
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .btn.small {
    min-height: 36px;
    font-size: 13px;
    padding: 0 12px;
  }
  .meter {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 4px;
  }
  .meter span {
    height: 12px;
    box-sizing: border-box;
    border: 1.5px solid var(--ink);
    border-radius: 2px;
    transition: background 150ms;
  }
  .meter span.done {
    background: var(--ink);
  }
  .meter span.now {
    background: var(--pink);
    animation: blink 0.7s steps(2) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0.45;
    }
  }
  /* keep the bar inside the column on wide screens */
  @media (min-width: 560px) {
    .bar {
      padding-left: calc(50% - 264px);
      padding-right: calc(50% - 264px);
    }
  }
</style>
