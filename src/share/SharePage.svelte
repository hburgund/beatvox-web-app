<script lang="ts">
  // The page a BeatVox link opens (/b/<id>): the beat as a ring that is also
  // its loop player, the source vox, a small map of every beat made from the
  // same vox (tap it for the bigger map), and a way to make your own.
  import Ring from '../lib/ui/Ring.svelte';
  import MiniClock from '../lib/ui/MiniClock.svelte';
  import FamilyMap from './FamilyMap.svelte';
  import { Player } from './player.svelte';
  import { loadShared, ringRows, type Shared, type SharedMix } from '../lib/shared';
  import { MAP_PATH, STUDIO_PATH, beatvoxShareUrl, mapUrl, revoxUrl } from '../lib/roundware';

  let { id }: { id: number } = $props();

  let data = $state<Shared | null>(null);
  let failed = $state('');
  let width = $state(358);
  let sheetOpen = $state(false);
  let note = $state('');
  let dialog = $state<HTMLDialogElement>();
  const p = new Player();

  $effect(() => {
    let gone = false;
    loadShared(id)
      .then((d) => {
        if (gone) return;
        data = d;
        if (d.status === 'live') {
          document.title = `${d.mix.title} · BeatVox`;
          p.preload(d.mix.file).catch(() => {});
        }
      })
      .catch(() => {
        if (!gone) failed = "Couldn't reach the BeatVox server. Check your connection and try again.";
      });
    return () => {
      gone = true;
      p.stop();
    };
  });

  const live = $derived(data?.status === 'live' ? data : null);
  const rows = $derived(ringRows(live?.mix.recipe ?? null));
  const ringSize = $derived(Math.min(340, width));
  // a reVox names the beat whose vox it plays
  const source = $derived(live?.mix.recipe?.revoxOf ? (live.family.find((m) => m.id === live.mix.recipe!.revoxOf) ?? null) : null);
  const places = $derived(live ? new Set(live.family.map((m) => `${m.latitude.toFixed(1)},${m.longitude.toFixed(1)}`)).size : 0);

  const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const bpmOf = (m: SharedMix) => m.recipe?.bpm ?? 120;

  function playMain() {
    if (live) void p.toggle('main', live.mix.file, { loop: true, bpm: bpmOf(live.mix) });
  }
  function playVox() {
    if (live) void p.toggle('vox', live.vox.file, { loop: false });
  }
  function playFamily(m: SharedMix) {
    void p.toggle(m.id === live?.mix.id ? 'main' : `mix${m.id}`, m.file, { loop: true, bpm: bpmOf(m) });
  }

  async function share() {
    if (!live) return;
    const url = beatvoxShareUrl(live.mix.id);
    const text = `${live.mix.title}: a beat made from one voice on BeatVox`;
    try {
      if (navigator.share) {
        await navigator.share({ title: live.mix.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      note = 'Link copied.';
    } catch (e) {
      if ((e as Error).name !== 'AbortError') note = url;
    }
  }

  function openSheet() {
    sheetOpen = true;
    dialog?.showModal();
  }
  function closeSheet() {
    dialog?.close();
  }
</script>

<div class="page">
  <header>
    <a class="brand" href={MAP_PATH}>BEATVOX</a>
    <a class="btn" href={live ? mapUrl(live.mix.id) : MAP_PATH}>MAP</a>
  </header>

  <main bind:clientWidth={width}>
    {#if failed}
      <section class="card notice">
        <p class="label">SOMETHING WENT WRONG</p>
        <p>{failed}</p>
        <button class="btn" onclick={() => location.reload()}>TRY AGAIN</button>
      </section>
    {:else if !data}
      <p class="loading" aria-live="polite">Loading the beat…</p>
    {:else if data.status === 'pending'}
      <section class="card notice wait">
        <p class="label">WAITING FOR APPROVAL</p>
        <h1>This BeatVox isn't on the map yet.</h1>
        <p>Every new BeatVox is checked by a person before it goes public. This link will play it as soon as it's approved.</p>
      </section>
      <a class="btn primary big" href={STUDIO_PATH}>MAKE YOUR OWN</a>
    {:else if data.status === 'missing'}
      <section class="card notice">
        <p class="label">NOT FOUND</p>
        <h1>There's no BeatVox here.</h1>
        <p>It may have been taken down, or the link is incomplete.</p>
      </section>
      <a class="btn primary big" href={STUDIO_PATH}>MAKE YOUR OWN</a>
    {:else if live}
      <div class="title">
        <div>
          <p class="label kicker">{source ? 'A REVOX' : 'A BEATVOX'} · {day(live.mix.createdAt).toUpperCase()}</p>
          <h1>{live.mix.title}</h1>
          {#if source}<p class="sub from">made with the vox from <a href="/b/{source.id}">{source.title}</a></p>{/if}
        </div>
        <button class="btn icon" aria-label="Share this BeatVox" onclick={share}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"
            ><path d="M10 13V3M6 7l4-4 4 4M4 11v6h12v-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="square" /></svg
          >
        </button>
      </div>
      {#if note}<p class="note" aria-live="polite">{note}</p>{/if}

      <div class="ring">
        <Ring {rows} step={p.playing === 'main' ? p.step : -1} size={ringSize} label="The beat as a circle: 8 rings of 16 steps, colored by sound">
          <button
            class="play"
            aria-label={p.playing === 'main' ? 'Pause the beat' : 'Play the beat'}
            aria-pressed={p.playing === 'main'}
            onclick={playMain}
          >
            {#if p.loading === 'main'}
              <span class="spin" aria-hidden="true"></span>
            {:else if p.playing === 'main'}
              <svg width="26" height="26" viewBox="0 0 20 20" aria-hidden="true"
                ><rect x="4" y="3" width="4.5" height="14" fill="currentColor" /><rect x="11.5" y="3" width="4.5" height="14" fill="currentColor" /></svg
              >
            {:else}
              <svg width="30" height="30" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 2l11 7-11 7z" fill="currentColor" /></svg>
            {/if}
          </button>
        </Ring>
      </div>
      {#if !live.mix.recipe}
        <p class="note">This beat was saved without its pattern, so the ring is empty. It still plays.</p>
      {/if}

      <div class="vox">
        <button class="vox-play" aria-label={p.playing === 'vox' ? 'Stop the source vox' : 'Hear the source vox'} aria-pressed={p.playing === 'vox'} onclick={playVox}>
          {#if p.playing === 'vox'}
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" fill="currentColor" /></svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 2l11 7-11 7z" fill="currentColor" /></svg>
          {/if}
        </button>
        <div>
          <p class="label vox-name">THE SOURCE VOX</p>
          <p class="sub">the recording this beat is made from</p>
        </div>
      </div>

      <button class="mini-map" onclick={openSheet} aria-label="This vox around the world: {live.family.length} beats. Open the map.">
        <div class="tiles"><FamilyMap family={live.family} current={live.mix.id} /></div>
        <div class="strip">
          <span class="label">THIS VOX · {live.family.length} {live.family.length === 1 ? 'BEAT' : 'BEATS'} · {places} {places === 1 ? 'PLACE' : 'PLACES'}</span>
          <span class="open">open</span>
        </div>
      </button>
      {#if p.error}<p class="note" role="alert">{p.error}</p>{/if}
    {/if}
  </main>
</div>

{#if live}
  <div class="bar">
    {#if live.revoxAllowed}
      <a class="btn primary" href={revoxUrl(live.mix.id)}>REVOX THIS VOX</a>
      <p>Make your own beat with this vox, or <a href={STUDIO_PATH}>record your own</a>.</p>
    {:else}
      <a class="btn primary" href={STUDIO_PATH}>MAKE YOUR OWN</a>
      <p>Record your voice and BeatVox makes a beat from it.</p>
    {/if}
  </div>

  <dialog bind:this={dialog} class="sheet" aria-label="This vox around the world" onclose={() => (sheetOpen = false)}>
    <div class="sheet-head">
      <div>
        <p class="label sheet-title">THIS VOX AROUND THE WORLD</p>
        <p class="sub">{live.family.length} {live.family.length === 1 ? 'beat' : 'beats'} made from it so far</p>
      </div>
      <button class="btn icon" aria-label="Close the map" onclick={closeSheet}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2.4" /></svg>
      </button>
    </div>
    <div class="big-map">
      {#if sheetOpen}
        <FamilyMap family={live.family} current={live.mix.id} interactive onpick={(mid) => {
          const m = live.family.find((f) => f.id === mid);
          if (m) playFamily(m);
        }} />
      {/if}
    </div>
    <ul class="family">
      {#each live.family as m (m.id)}
        {@const key = m.id === live.mix.id ? 'main' : `mix${m.id}`}
        <li>
          <MiniClock
            rows={ringRows(m.recipe)}
            current={m.id === live.mix.id}
            playing={p.playing === key}
            loading={p.loading === key}
            step={p.playing === key ? p.step : -1}
            label={p.playing === key ? `Stop ${m.title}` : `Play ${m.title}`}
            onclick={() => playFamily(m)}
          />
          <div class="who">
            {#if m.id === live.mix.id}
              <span class="name">{m.title}</span>
            {:else}
              <a class="name" href="/b/{m.id}">{m.title}</a>
            {/if}
            <span class="sub">{day(m.createdAt)}</span>
          </div>
          {#if m.id === live.mix.id}<span class="label tag">THIS ONE</span>{/if}
        </li>
      {/each}
    </ul>
    <div class="sheet-foot">
      <a class="btn" href={mapUrl(live.mix.id)}>THE WHOLE MAP</a>
      <a class="btn primary" href={live.revoxAllowed ? revoxUrl(live.mix.id) : STUDIO_PATH}>ADD YOURS</a>
    </div>
  </dialog>
{/if}

<style>
  .page {
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
    font: 700 28px/1 var(--mono);
    letter-spacing: 0.03em;
    text-shadow: 2px 2px 0 var(--pink);
    color: var(--ink);
    text-decoration: none;
  }
  header .btn,
  .bar .btn,
  .sheet-foot .btn,
  .big {
    text-decoration: none;
    color: var(--ink);
  }
  main {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h1 {
    margin: 2px 0 0;
    font: 700 30px/1.05 var(--mono);
    overflow-wrap: anywhere;
  }
  p {
    margin: 0;
  }
  .title {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
  }
  .kicker,
  .sub {
    color: var(--muted);
  }
  .kicker {
    font-size: 12px;
  }
  .sub {
    font: 13px/1.35 var(--sans);
  }
  .from {
    margin-top: 4px;
  }
  .from a {
    color: var(--ink);
    font-weight: 600;
  }
  .btn.icon {
    width: 44px;
    padding: 0;
    flex: none;
  }
  .note {
    font: 13px/1.4 var(--sans);
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .loading {
    padding: 40px 0;
    text-align: center;
    color: var(--muted);
  }
  .ring {
    align-self: center;
  }
  .play {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    border: 3px solid var(--ink);
    background: var(--yellow);
    color: var(--ink);
    box-shadow: 3px 3px 0 var(--pink);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: manipulation;
  }
  .play:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--pink);
  }
  .spin {
    width: 22px;
    height: 22px;
    border: 3px solid var(--ink);
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .vox {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 2px;
  }
  .vox-play {
    width: 48px;
    height: 48px;
    flex: none;
    border-radius: 50%;
    border: 2.5px solid var(--ink);
    background: var(--card);
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .vox-play[aria-pressed='true'] {
    background: var(--yellow);
  }
  .vox-name {
    font-size: 15px;
    letter-spacing: 0.08em;
  }
  .mini-map {
    display: block;
    width: 100%;
    padding: 0;
    border: 2px solid var(--ink);
    border-radius: 8px;
    overflow: hidden;
    background: var(--card);
    text-align: left;
    cursor: pointer;
  }
  .tiles {
    height: 110px;
  }
  .strip {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    padding: 8px 10px;
    border-top: 2px solid var(--ink);
  }
  .open {
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .notice {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 12px;
  }
  .notice p:not(.label) {
    font: 15px/1.45 var(--sans);
  }
  .notice h1 {
    font-size: 24px;
  }
  .wait {
    box-shadow: 4px 4px 0 var(--yellow);
  }
  .big {
    min-height: 56px;
    font-size: 17px;
  }
  .bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    min-height: var(--bar-h);
    box-sizing: border-box;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    border-top: 2px solid var(--ink);
    background: var(--card);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    z-index: 5;
  }
  .bar .btn {
    min-height: 52px;
    font-size: 16px;
    flex: none;
  }
  .bar p {
    font: 13px/1.35 var(--sans);
    color: var(--muted);
    max-width: 260px;
  }
  .bar p a {
    color: var(--ink);
    font-weight: 600;
  }
  .sheet {
    width: 100%;
    max-width: 560px;
    height: calc(100dvh - 64px);
    max-height: none;
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
  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 16px 10px;
  }
  .sheet-title {
    font-size: 16px;
    letter-spacing: 0.06em;
  }
  .big-map {
    height: 42%;
    min-height: 220px;
    flex: none;
    border-top: 2px solid var(--ink);
    border-bottom: 2px solid var(--ink);
  }
  .family {
    list-style: none;
    margin: 0;
    padding: 4px 16px;
    overflow-y: auto;
    flex: 1;
  }
  .family li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    border-top: 1.5px solid var(--soft);
  }
  .family li:first-child {
    border-top: none;
  }
  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .name {
    font-weight: 700;
    font-size: 15px;
    color: var(--ink);
  }
  .tag {
    font-size: 11px;
    color: var(--muted);
  }
  .sheet-foot {
    display: flex;
    gap: 10px;
    padding: 10px 16px calc(14px + env(safe-area-inset-bottom));
    border-top: 2px solid var(--ink);
    background: var(--card);
  }
  .sheet-foot .btn {
    flex: 1;
    min-height: 48px;
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet,
    .spin {
      transition: none;
      animation: none;
    }
  }
</style>
