<!--
  LIKE and FLAG for one BeatVox, under its ring (the map's mix sheet and its
  share page). Each is a Roundware vote, once per BeatVox per device: a like
  can't be taken back, and a flag asks first, since it sends the BeatVox
  for review.
-->
<script lang="ts">
  import { rw } from '../rw';
  import { hasVoted, markVoted } from '../votes';

  let { asset }: { asset: number } = $props();

  let liked = $state(false);
  let flagged = $state(false);
  let asking = $state(false);
  let busy = $state(false);
  let note = $state('');

  // another BeatVox in the same sheet: start over with what this device did
  $effect(() => {
    liked = hasVoted('like', asset);
    flagged = hasVoted('flag', asset);
    asking = false;
    note = '';
  });

  async function like() {
    if (liked || busy) return;
    const a = asset;
    busy = true;
    liked = true;
    note = '';
    if (await rw.vote(a, 'like')) markVoted('like', a);
    else if (a === asset) {
      liked = false;
      note = "Couldn't send your like. Check your connection and try again.";
    }
    busy = false;
  }

  async function flag() {
    if (flagged || busy) return;
    const a = asset;
    busy = true;
    note = '';
    const ok = await rw.vote(a, 'flag');
    busy = false;
    if (a !== asset) return;
    if (ok) {
      markVoted('flag', a);
      flagged = true;
      asking = false;
      note = 'Thanks. It will be reviewed.';
    } else note = "Couldn't send the flag. Check your connection and try again.";
  }
</script>

<div class="votes">
  <div class="row">
    <button class="btn" class:liked aria-pressed={liked} disabled={busy && !liked} onclick={like}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
        ><path
          d="M8 14S1.5 10 1.5 5.5A3.2 3.2 0 0 1 8 4a3.2 3.2 0 0 1 6.5 1.5C14.5 10 8 14 8 14z"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        /></svg
      >
      {liked ? 'LIKED' : 'LIKE'}
    </button>
    <button class="btn" aria-pressed={flagged || asking} disabled={flagged} onclick={() => (asking = !asking)}>
      <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"
        ><path d="M2 15V1.5M2 2h10l-2.5 3.5L12 9H2" fill={flagged ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg
      >
      {flagged ? 'FLAGGED' : 'FLAG'}
    </button>
  </div>

  {#if asking && !flagged}
    <div class="ask" role="group" aria-label="Flag this BeatVox">
      <p>Flag this BeatVox for review? For anything hateful or abusive, or a voice or recording used without permission.</p>
      <div class="row">
        <button class="btn primary" disabled={busy} onclick={flag}>FLAG IT</button>
        <button class="link" onclick={() => (asking = false)}>cancel</button>
      </div>
    </div>
  {/if}
  {#if note}<p class="note" aria-live="polite">{note}</p>{/if}
</div>

<style>
  .votes {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
  }
  .btn {
    min-height: 40px;
    font-size: 13px;
  }
  .liked {
    background: var(--pink);
  }
  .ask {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 34ch;
    text-align: center;
  }
  .ask p,
  .note {
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    text-align: center;
  }
</style>
