<script lang="ts">
  // BeatVox's home page: every BeatVox and reVox where its maker put it, on
  // a riso-styled globe (MapLibre, OpenStreetMap data via OpenFreeMap).
  // Mixes made from the same vox are joined by lines from the first one, so
  // a vox's travels show. Zoomed out a mix is a dot; zoomed in, a small clock
  // showing its rhythm. Tap one to hear it and see its details (a sheet on a
  // phone, a side panel on a bigger screen). Wander plays one mix after
  // another, at random, from anywhere or from the same vox, and pans to each.
  import type { Map as MlMap, Marker, GeoJSONSource } from 'maplibre-gl';
  import { untrack } from 'svelte';
  import { risoMap, type Maplibre } from './risoMap';
  import MixDetail from './MixDetail.svelte';
  import Welcome from './Welcome.svelte';
  import About from '../about/About.svelte';
  import AboutButton from '../about/AboutButton.svelte';
  import { about } from '../about/aboutState.svelte';
  import Check from '../lib/ui/Check.svelte';
  import { Player } from '../share/player.svelte';
  import { loadMap, loadRecipe, passes, type MapData, type MapMix } from '../lib/mapData';
  import { ringRows, type RingRow } from '../lib/shared';
  import { clockMarker } from '../lib/clockMarker';
  import { STUDIO_PATH } from '../lib/roundware';
  import { ShuffleBag } from '../lib/shuffleBag';
  import { greatCircle } from '../lib/greatCircle';

  let data = $state.raw<MapData | null>(null);
  let failed = $state('');
  let chosen = $state.raw(new Set<number>());
  let selected = $state.raw<MapMix | null>(null);
  /** each mix's rows for its clock marker, as recipes arrive */
  let marks = $state.raw(new Map<number, RingRow[]>());
  let zoom = $state(2);
  /** zoomed in far enough for clocks instead of dots; markers are only redrawn when this flips */
  const clocks = $derived(zoom >= 4);
  let wide = $state(false);
  let wandering = $state(false);
  let scope = $state<'anywhere' | 'vox'>('anywhere');
  let filterDlg = $state<HTMLDialogElement>();
  let el: HTMLDivElement;
  let map: MlMap | null = null;
  let ml: Maplibre | null = null;
  let markers: Marker[] = [];
  /** how faint a mix on the far side of the globe shows through (MapLibre's default is 0.2) */
  const FAR_SIDE = '0.08';

  /** Mixes on the far side of the globe show faintly through it but can't be clicked or tabbed to. */
  function markFarSide() {
    for (const m of markers) {
      const el = m.getElement();
      const far = el.style.opacity === FAR_SIDE;
      if (el.classList.contains('far') === far) continue;
      el.classList.toggle('far', far);
      el.tabIndex = far ? -1 : 0;
      el.toggleAttribute('aria-hidden', far);
    }
  }
  /** the map is up (markers wait for it) */
  let ready = $state(false);
  const player = new Player();

  // A first visit gets the welcome card, once. Not when a link opened a mix
  // or About: those already say what this is.
  const WELCOMED = 'beatvox.welcomed';
  let welcome = $state(firstVisit());
  function firstVisit() {
    if (new URLSearchParams(location.search).has('m') || about.open) return false;
    try {
      return !localStorage.getItem(WELCOMED);
    } catch {
      return true;
    }
  }
  function dismissWelcome() {
    welcome = false;
    try {
      localStorage.setItem(WELCOMED, '1');
    } catch {
      // private mode: it just shows again next time
    }
  }
  // tapping a beat or opening About counts as having seen it
  $effect(() => {
    if (welcome && (selected || about.open)) dismissWelcome();
  });
  /** The card's LISTEN: start Wander. */
  function listen() {
    dismissWelcome();
    if (!wandering) toggleWander();
  }

  const visible = $derived(data ? data.mixes.filter((m) => passes(m, data!.filters, chosen)) : []);
  const chosenCount = $derived(chosen.size);

  // a bigger screen gets a side panel instead of a sheet
  $effect(() => {
    const mq = matchMedia('(min-width: 900px)');
    wide = mq.matches;
    const on = () => (wide = mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  });

  // the map itself, once: a globe, roads left out so the beats stand out
  $effect(() => {
    let gone = false;
    risoMap(el, { globe: true, roads: false, center: [-30, 30], zoom: 1, maxZoom: 16, renderWorldCopies: false }).then((r) => {
      if (gone) return r.map.remove();
      map = r.map;
      ml = r.ml;
      map.on('zoomend', () => (zoom = map!.getZoom()));
      // markers update their own opacity as the globe turns; follow it
      map.on('render', markFarSide);
      map.on('load', () => {
        // the lines joining mixes of the same vox: dashed ink, or solid pink for the chosen vox
        map!.addSource('family', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map!.addLayer({
          id: 'family',
          type: 'line',
          source: 'family',
          filter: ['!', ['get', 'mine']],
          paint: { 'line-color': '#1d1b16', 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [3, 3] },
        });
        map!.addLayer({
          id: 'family-mine',
          type: 'line',
          source: 'family',
          filter: ['get', 'mine'],
          paint: { 'line-color': '#ff5c80', 'line-width': 3 },
        });
        zoom = map!.getZoom();
        ready = true;
        if (untrack(() => data)) place();
      });
    });
    return () => {
      gone = true;
      markers.forEach((m) => m.remove());
      markers = [];
      map?.remove();
      map = null;
    };
  });

  // the mixes, once
  $effect(() => {
    let gone = false;
    loadMap()
      .then((d) => {
        if (gone) return;
        data = d;
        place();
        loadMarks(d);
      })
      .catch(() => {
        if (!gone) failed = "Couldn't reach the BeatVox server. Check your connection and reload.";
      });
    return () => {
      gone = true;
      player.stop();
    };
  });

  /** First view: the mix in ?m=, or every mix. */
  function place() {
    if (!map || !data || !ml || !ready) return;
    const want = Number(new URLSearchParams(location.search).get('m'));
    const m = data.mixes.find((x) => x.id === want);
    if (m) {
      selected = m;
      map.jumpTo({ center: [m.longitude, m.latitude], zoom: 5 });
    } else if (data.mixes.length > 1) {
      const b = new ml.LngLatBounds();
      data.mixes.forEach((x) => b.extend([x.longitude, x.latitude]));
      map.fitBounds(b, { padding: 60, maxZoom: 5, duration: 0 });
    } else if (data.mixes.length) {
      map.jumpTo({ center: [data.mixes[0].longitude, data.mixes[0].latitude], zoom: 4 });
    }
  }

  /** Recipes for the clock markers, a few at a time, redrawn in batches. */
  async function loadMarks(d: MapData) {
    const todo = d.mixes.filter((m) => d.recipeUrls.has(m.id));
    const got = new Map(marks);
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const m = todo[i++];
        const r = await loadRecipe(d.recipeUrls.get(m.id));
        if (r) got.set(m.id, ringRows(r));
      }
    };
    const flush = setInterval(() => (marks = new Map(got)), 400);
    await Promise.all(Array.from({ length: 6 }, worker));
    clearInterval(flush);
    marks = new Map(got);
  }

  // markers and family lines, redrawn when what's shown changes
  $effect(() => {
    if (!ready || !map || !ml || !data) return;
    const show = visible;
    const sel = selected;
    const big = clocks;
    const mk = marks;
    const ids = new Set(show.map((m) => m.id));
    // lines: from a vox's first shown mix to each of its others
    const features: GeoJSON.Feature[] = [];
    for (const fam of data.families.values()) {
      const f = fam.filter((m) => ids.has(m.id));
      for (const m of f.slice(1)) {
        features.push({
          type: 'Feature',
          properties: { mine: sel?.voxId === f[0].voxId },
          // the shortest route over the globe, not a straight line on the flat map
          geometry: { type: 'LineString', coordinates: greatCircle([f[0].longitude, f[0].latitude], [m.longitude, m.latitude]) },
        });
      }
    }
    (map.getSource('family') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
    // zoomed out a dot, zoomed in a clock; the chosen one drawn last, on top
    markers.forEach((m) => m.remove());
    markers = [];
    for (const m of [...show].sort((a, b) => Number(a.id === sel?.id) - Number(b.id === sel?.id))) {
      const on = m.id === sel?.id;
      const el = document.createElement('button');
      el.className = `bv-pin${on ? ' on' : ''}`;
      el.setAttribute('aria-label', `${m.title}${on ? ' (open)' : ''}`);
      el.title = m.title;
      el.innerHTML = big
        ? clockMarker(mk.get(m.id) ?? null, { size: on ? 52 : 40, selected: on })
        : `<span class="bv-dot${on ? ' on' : ''}${m.revox ? ' revox' : ''}"></span>`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        pick(m, true);
      });
      // start faint if it's round the back, so it doesn't flash at full strength for a frame
      if (map.transform.isLocationOccluded(new ml.LngLat(m.longitude, m.latitude))) el.style.opacity = FAR_SIDE;
      markers.push(new ml.Marker({ element: el, opacityWhenCovered: FAR_SIDE }).setLngLat([m.longitude, m.latitude]).addTo(map));
    }
    markFarSide();
  });

  /** Show a mix's details; from a tap, play it too. */
  function pick(m: MapMix, play: boolean) {
    clearTimeout(pending);
    selected = m;
    if (play) void playMix(m);
    reveal(m);
  }

  function pickId(id: number) {
    const m = data?.mixes.find((x) => x.id === id);
    if (m) pick(m, true);
  }

  /** Move the map so a mix sits in the part the sheet or panel doesn't cover. */
  function reveal(m: MapMix, fly = false) {
    // wait a frame for the sheet to lay out
    requestAnimationFrame(() => {
      if (!map) return;
      const sheet = document.querySelector('.panel') as HTMLElement | null;
      const h = map.getContainer().clientHeight;
      const offset: [number, number] = !sheet ? [0, 0] : wide ? [-sheet.offsetWidth / 2, 0] : [0, -Math.min(sheet.offsetHeight, h * 0.7) / 2];
      const center: [number, number] = [m.longitude, m.latitude];
      if (fly) map.flyTo({ center, offset, zoom: Math.max(map.getZoom(), 3.5), duration: 2200, essential: true });
      else map.easeTo({ center, offset, duration: 500 });
    });
  }

  async function playMix(m: MapMix) {
    const r = await loadRecipe(data?.recipeUrls.get(m.id));
    const bpm = r?.bpm ?? 120;
    // wandering: once through, faded in and out, then a pause, then the next
    const opts = wandering ? { loop: false, bpm, fadeIn: FADE, fadeOut: FADE, onend: () => later(next, GAP) } : { loop: true, bpm };
    void player.play(`mix${m.id}`, m.file, opts);
  }

  /** The detail's play button: stop it (and wandering), or play it. */
  function toggleSelected() {
    if (!selected) return;
    if (player.playing === `mix${selected.id}`) {
      stopWander();
      player.stop(0.3);
    } else void playMix(selected);
  }

  // ── Wander ────────────────────────────────────────────────────────────

  /** seconds each mix fades in and out when wandering */
  const FADE = 1;
  /** silence between one mix's end and the next one's start (ms) */
  const GAP = 500;
  let pending = 0;
  /** every mix in the pool once, in random order, before any repeats */
  const bag = new ShuffleBag();
  /** run `f` after `ms`, unless wandering stops or something else is chosen first */
  function later(f: () => void, ms: number) {
    clearTimeout(pending);
    pending = window.setTimeout(() => wandering && f(), ms);
  }

  function stopWander() {
    wandering = false;
    clearTimeout(pending);
  }

  /** Skip: fade this one out quickly and go on to the next. */
  function skip() {
    if (!wandering) return;
    player.stop(0.5);
    later(next, 500);
  }

  /** Replay: start this one again from the top. */
  function replay() {
    if (!selected) return;
    const m = selected;
    clearTimeout(pending);
    player.stop(0.3);
    window.setTimeout(() => void playMix(m), 320);
  }

  function next() {
    const pool = scope === 'vox' && selected ? visible.filter((m) => m.voxId === selected!.voxId) : visible;
    const id = bag.next(
      pool.map((m) => m.id),
      selected?.id,
    );
    const m = pool.find((x) => x.id === id);
    if (!m) {
      wandering = false;
      return;
    }
    selected = m;
    reveal(m, true);
    void playMix(m);
  }

  function toggleWander() {
    if (wandering) {
      stopWander();
      player.stop(0.6);
      return;
    }
    wandering = true;
    if (selected) bag.mark(selected.id);
    if (selected && player.playing !== `mix${selected.id}`) void playMix(selected);
    else if (!selected) next();
    // a mix already looping finishes this time round, then wandering moves on
    else void playMix(selected);
  }

  function close() {
    selected = null;
    if (!wandering) player.stop();
  }

  function toggleTag(tagId: number, on: boolean) {
    const s = new Set(chosen);
    if (on) s.add(tagId);
    else s.delete(tagId);
    chosen = s;
    if (selected && data && !passes(selected, data.filters, s)) close();
  }
</script>

<div class="page">
  <header>
    <div class="left">
      <span class="brand">BEATVOX</span>
      <AboutButton />
    </div>
    <div class="tools">
      <button class="btn" class:on={chosenCount > 0} onclick={() => filterDlg?.showModal()} aria-haspopup="dialog">
        FILTER{chosenCount ? ` · ${chosenCount}` : ''}
      </button>
      <a class="btn primary" href={STUDIO_PATH}>MAKE YOURS</a>
    </div>
  </header>

  <div class="map-wrap">
    <div class="map" bind:this={el} role="region" aria-label="Map of BeatVoxes"></div>
    <div class="zoom" role="group" aria-label="Zoom">
      <button class="btn" aria-label="Zoom in" onclick={() => map?.zoomIn()}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 3v12M3 9h12" stroke="currentColor" stroke-width="2.6" /></svg>
      </button>
      <button class="btn" aria-label="Zoom out" onclick={() => map?.zoomOut()}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 9h12" stroke="currentColor" stroke-width="2.6" /></svg>
      </button>
    </div>
  </div>

  {#if failed}
    <p class="toast" role="alert">{failed}</p>
  {:else if !data}
    <p class="toast" aria-live="polite">Loading the map…</p>
  {/if}

  <div class="bar" class:with-panel={wide && selected}>
    <button class="btn wander" class:on={wandering} aria-pressed={wandering} onclick={toggleWander} disabled={!visible.length}>
      {#if wandering}
        <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" fill="currentColor" /></svg> STOP
      {:else}
        <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 2l11 7-11 7z" fill="currentColor" /></svg> WANDER
      {/if}
    </button>
    {#if wandering}
      <button class="btn icon-btn" aria-label="Replay this one" title="Replay" onclick={replay} disabled={!selected}>
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 6.5A6.5 6.5 0 1 1 3.6 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" /><path d="M2.5 3v4.5H7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" /></svg>
      </button>
      <button class="btn icon-btn" aria-label="Skip to the next one" title="Skip" onclick={skip}>
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3l9 7-9 7z" fill="currentColor" /><rect x="14" y="3" width="3" height="14" fill="currentColor" /></svg>
      </button>
    {/if}
    <div class="scope" role="radiogroup" aria-label="Wander through">
      <button role="radio" aria-checked={scope === 'anywhere'} class:on={scope === 'anywhere'} onclick={() => (scope = 'anywhere')}>ANYWHERE</button>
      <button role="radio" aria-checked={scope === 'vox'} class:on={scope === 'vox'} disabled={!selected} onclick={() => (scope = 'vox')}>THIS VOX</button>
    </div>
    <span class="count">{visible.length} {visible.length === 1 ? 'BEAT' : 'BEATS'}</span>
  </div>

  {#if selected}
    <aside class="panel" class:side={wide} aria-label="{selected.title}: details">
      <MixDetail
        mix={selected}
        {player}
        {wandering}
        ringSize={wide ? 300 : 210}
        onplay={toggleSelected}
        onpick={pickId}
        onclose={close}
      />
    </aside>
  {/if}

  {#if welcome}
    <Welcome canListen={visible.length > 0} onlisten={listen} onclose={dismissWelcome} />
  {/if}
</div>

<About
  wander={wandering && selected
    ? {
        title: selected.title,
        skip,
        stop: () => {
          stopWander();
          player.stop(0.6);
        },
      }
    : null}
/>

<dialog bind:this={filterDlg} class="filters" aria-label="Filter the map">
  <div class="f-head">
    <span class="label">FILTER</span>
    <button class="btn icon" aria-label="Close" onclick={() => filterDlg?.close()}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2.4" /></svg>
    </button>
  </div>
  {#each data?.filters ?? [] as g (g.name)}
    <fieldset>
      <legend class="label">{g.name}</legend>
      {#each g.items as it (it.tagId)}
        <Check bind:checked={() => chosen.has(it.tagId), (v) => toggleTag(it.tagId, v)}>{it.label}</Check>
      {/each}
    </fieldset>
  {/each}
  <p class="f-note">Nothing ticked in a group shows all of it.</p>
  <div class="f-foot">
    <button class="link" onclick={() => ((chosen = new Set()), undefined)} disabled={!chosenCount}>clear</button>
    <button class="btn primary" onclick={() => filterDlg?.close()}>SHOW {visible.length}</button>
  </div>
</dialog>

<style>
  .page {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
  }
  header {
    height: 64px;
    flex: none;
    box-sizing: border-box;
    padding: 0 12px 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-bottom: 2px solid var(--ink);
    background: var(--paper);
    z-index: 2;
  }
  .left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .brand {
    font: 700 26px/1 var(--mono);
    letter-spacing: 0.03em;
    text-shadow: 2px 2px 0 var(--pink);
  }
  .tools {
    display: flex;
    gap: 8px;
  }
  .tools .btn {
    text-decoration: none;
    color: var(--ink);
    padding: 0 10px;
    white-space: nowrap;
  }
  .map-wrap {
    flex: 1;
    position: relative;
    display: flex;
    min-height: 0;
  }
  /* zoom buttons on the left, where the side panel never covers them */
  .zoom {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .zoom .btn {
    width: 44px;
    padding: 0;
    box-shadow: 2px 2px 0 var(--ink);
  }
  .map {
    flex: 1;
    background: var(--paper);
    /* keep Leaflet's own layers (z-index 400+) below the bar and panel */
    position: relative;
    z-index: 0;
  }
  .map :global(.bv-pin) {
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    line-height: 0;
  }
  .map :global(.bv-pin.far) {
    pointer-events: none;
  }
  .map :global(.bv-pin svg) {
    display: block;
  }
  .map :global(.bv-pin:focus-visible) {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
    border-radius: 50%;
  }
  .map :global(.bv-dot) {
    display: block;
    width: 12px;
    height: 12px;
    box-sizing: border-box;
    border-radius: 50%;
    background: var(--blue);
    border: 2px solid var(--ink);
  }
  .map :global(.bv-dot.revox) {
    background: var(--yellow);
  }
  .map :global(.bv-dot.on) {
    width: 18px;
    height: 18px;
    background: var(--pink);
  }
  .toast {
    position: fixed;
    top: 76px;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 8px 14px;
    border: 2px solid var(--ink);
    border-radius: 6px;
    background: var(--card);
    z-index: 3;
    font: 14px var(--sans);
  }
  .bar {
    flex: none;
    min-height: 64px;
    box-sizing: border-box;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    display: flex;
    align-items: center;
    gap: 8px;
    border-top: 2px solid var(--ink);
    background: var(--card);
    z-index: 2;
  }
  .bar.with-panel {
    margin-right: 400px;
  }
  .wander {
    min-width: 96px;
    padding: 0 10px;
  }
  .icon-btn {
    width: 44px;
    padding: 0;
    flex: none;
  }
  .scope {
    display: flex;
    border: 2px solid var(--ink);
    border-radius: 18px;
    overflow: hidden;
  }
  .scope button {
    min-height: 36px;
    padding: 0 8px;
    white-space: nowrap;
    border: none;
    background: var(--card);
    font: 700 12px var(--mono);
    cursor: pointer;
  }
  .scope button + button {
    border-left: 2px solid var(--ink);
  }
  .scope button.on {
    background: var(--yellow);
  }
  .scope button:disabled {
    color: var(--soft);
    cursor: default;
  }
  .count {
    margin-left: auto;
    font-weight: 700;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(64px + env(safe-area-inset-bottom));
    max-height: calc(100dvh - 64px - 64px - 40px);
    overflow-y: auto;
    box-sizing: border-box;
    padding: 14px 16px 16px;
    background: var(--card);
    border-top: 2px solid var(--ink);
    border-radius: 14px 14px 0 0;
    z-index: 3;
    animation: up 220ms ease;
  }
  .panel.side {
    left: auto;
    top: 64px;
    bottom: 0;
    width: 400px;
    max-height: none;
    border-top: none;
    border-left: 2px solid var(--ink);
    border-radius: 0;
    animation: in 220ms ease;
  }
  @keyframes up {
    from {
      transform: translateY(100%);
    }
  }
  @keyframes in {
    from {
      transform: translateX(100%);
    }
  }
  .btn.icon {
    width: 44px;
    padding: 0;
  }
  .filters {
    width: min(360px, calc(100vw - 32px));
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 8px;
    background: var(--card);
    color: var(--ink);
    padding: 14px 16px;
    box-shadow: 5px 5px 0 var(--blue);
  }
  .filters::backdrop {
    background: rgb(29 27 22 / 0.4);
  }
  .f-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  fieldset {
    border: none;
    margin: 10px 0 0;
    padding: 0;
  }
  legend {
    padding: 0;
    color: var(--muted);
  }
  .f-note {
    margin: 8px 0 0;
    font: 12px/1.35 var(--sans);
    color: var(--muted);
  }
  .f-foot {
    margin-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  @media (max-width: 400px) {
    header {
      padding: 0 10px 0 12px;
      gap: 6px;
    }
    .brand {
      font-size: 22px;
    }
    .left {
      gap: 12px;
    }
    .tools {
      gap: 6px;
    }
    .tools .btn {
      padding: 0 8px;
      font-size: 13px;
    }
    .count {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .panel,
    .panel.side {
      animation: none;
    }
  }
</style>
