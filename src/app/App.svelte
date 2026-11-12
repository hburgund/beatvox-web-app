<script lang="ts">
  // One studio screen: your voice and the beat together, the save bar along
  // the bottom, and the share sheet that rises from it.
  import Leds from '../lib/ui/Leds.svelte';
  import VoiceCard from './VoiceCard.svelte';
  import BeatCard from './BeatCard.svelte';
  import GrooveAudition from './GrooveAudition.svelte';
  import SaveBar from './SaveBar.svelte';
  import ShareSheet from './ShareSheet.svelte';
  import About from '../about/About.svelte';
  import AboutButton from '../about/AboutButton.svelte';
  import { about } from '../about/aboutState.svelte';
  import { MAP_PATH } from '../lib/roundware';
  import { Session } from './session.svelte';

  const s = new Session();
  let sheet = $state(false);

  // /studio?revox=<mix id>: open that BeatVox's vox to make your own beat with it
  const revox = Number(new URLSearchParams(location.search).get('revox'));
  if (revox > 0) void s.loadRevox(revox);

  // push dial changes into the engine and effects
  $effect(() => {
    void [s.volume, s.bpm, s.pitch, s.space, s.humanize];
    s.applyMix();
  });

  // a new capture (or a new voice) closes the sheet
  $effect(() => {
    if (s.share !== 'ready') sheet = false;
  });

  function key(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    // ⌘Z / Ctrl+Z undo, with Shift (or Ctrl+Y) redo; works after clicking a button too
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
      if (sheet || about.open || t.closest('input, select, textarea')) return;
      e.preventDefault();
      if (e.key === 'y' || e.shiftKey) s.redo();
      else s.undo();
      return;
    }
    if (sheet || about.open || t.closest('input, select, textarea, button, [role="slider"]')) return;
    if (!s.slices.length) return;
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
    <div class="brand">
      <h1>BEATVOX</h1>
      <Leds step={s.step} />
      <AboutButton />
    </div>
    <a class="btn" href={MAP_PATH}>MAP</a>
  </header>
  <main>
    <VoiceCard {s} />
    <BeatCard {s} />
    {#if import.meta.env.DEV}<GrooveAudition {s} />{/if}
  </main>
</div>

<SaveBar {s} onshare={() => (sheet = true)} />
<ShareSheet {s} open={sheet} onclose={() => (sheet = false)} />
<About />

<style>
  .app {
    max-width: 560px;
    margin: 0 auto;
    padding: 0 16px calc(var(--bar-h) + 24px);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 64px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  h1 {
    margin: 0;
    font: 700 28px/1 var(--mono);
    letter-spacing: 0.03em;
    text-shadow: 2px 2px 0 var(--pink);
  }
  header .btn {
    text-decoration: none;
    color: var(--ink);
  }
  main {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
