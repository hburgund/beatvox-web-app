<script lang="ts">
  import BeatLeds from '../lib/maxkit/BeatLeds.svelte';
  import RecordTab from './RecordTab.svelte';
  import ListenTab from './ListenTab.svelte';
  import ShareTab from './ShareTab.svelte';
  import { Session, SHARE_LOOPS, type Tab } from './session.svelte';

  const s = new Session();

  // phone layout below 640 px
  const mq = window.matchMedia('(max-width: 640px)');
  let narrow = $state(mq.matches);
  mq.addEventListener('change', (e) => (narrow = e.matches));

  // push slider changes into the engine and effects
  $effect(() => {
    void [s.volume, s.bpm, s.pitch, s.panning, s.space];
    s.applyMix();
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: 'record', label: 'Record' },
    { id: 'listen', label: 'Listen' },
    { id: 'share', label: 'Share' },
  ];

  function key(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('input, select, textarea, [role="slider"]')) return;
    if (s.tab !== 'listen' || !s.slices.length) return;
    if (e.key === ' ') {
      e.preventDefault();
      if (s.playing) s.stopBeat();
      else s.go();
    } else if (e.key === 'n' || e.key === 'N') s.newBeat();
    else if (e.key === 'e' || e.key === 'E') s.evolve();
  }
</script>

<svelte:window onkeydown={key} />

<div class="app">
  <header>
    <h1>BEAT VOX</h1>
    {#if s.share === 'waiting' || s.share === 'capturing'}
      <button class="rec" onclick={() => (s.tab = 'share')} aria-label="Capturing for your MP3">
        ● REC {s.share === 'waiting' ? '…' : `${Math.min(SHARE_LOOPS, Math.floor(s.shareProgress * SHARE_LOOPS) + 1)}/${SHARE_LOOPS}`}
      </button>
    {/if}
    <BeatLeds step={s.step} />
  </header>
  <nav>
    <div class="tabs" role="tablist">
      {#each TABS as t (t.id)}
        <button role="tab" class="tab" aria-selected={s.tab === t.id} onclick={() => (s.tab = t.id)}>{t.label}</button>
      {/each}
    </div>
    <span class="tag">putting rhythm into your voice…</span>
  </nav>
  <main class="panel">
    {#if s.tab === 'record'}
      <RecordTab {s} />
    {:else if s.tab === 'listen'}
      <ListenTab {s} {narrow} />
    {:else}
      <ShareTab {s} />
    {/if}
  </main>
</div>

<style>
  .app {
    max-width: 860px;
    margin: 0 auto;
    padding: 10px 16px 32px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    font: normal 44px/1 var(--bv-mono);
    letter-spacing: 3px;
    margin: 0;
  }
  .rec {
    margin-left: auto;
    border: 1px solid #900;
    border-radius: 999px;
    background: var(--bv-red);
    color: #fff;
    font: bold 12px var(--bv-mono);
    padding: 3px 10px;
    cursor: pointer;
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.6;
    }
  }
  nav {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 10px;
    margin-top: 6px;
  }
  .tabs {
    display: flex;
    gap: 3px;
  }
  .tab {
    border: 1px solid #777;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
    background: linear-gradient(#f0f0f0, #cfcfcf);
    padding: 5px 14px 4px;
    font: bold 13px Arial, sans-serif;
    cursor: pointer;
    margin-bottom: -1px;
    position: relative;
    touch-action: manipulation;
  }
  .tab[aria-selected='true'] {
    background: var(--bv-panel);
    z-index: 1;
  }
  .tag {
    font-size: 13px;
    padding-bottom: 3px;
    color: #222;
    white-space: nowrap;
  }
  main {
    border-top-left-radius: 0;
    min-height: 380px;
  }

  @media (max-width: 640px) {
    .app {
      padding: 8px 10px 24px;
    }
    h1 {
      font-size: 32px;
      letter-spacing: 2px;
    }
    .tag {
      display: none;
    }
    .tab {
      flex: 1;
      padding: 8px 10px 6px;
      font-size: 14px;
    }
    .tabs {
      flex: 1;
    }
  }
</style>
