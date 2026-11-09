<script lang="ts">
  // BeatVox's home page: every BeatVox and reVox where its maker put it.
  // Mixes made from the same vox are joined by lines from the first one, so
  // a vox's travels show. Zoomed out a mix is a dot; zoomed in, a small clock
  // showing its rhythm. Tap one to hear it and see its details (a sheet on a
  // phone, a side panel on a bigger screen). Wander plays one mix after
  // another, at random, from anywhere or from the same vox, and pans to each.
  import type { Map as LMap, LayerGroup } from 'leaflet';
  import { untrack } from 'svelte';
  import MixDetail from './MixDetail.svelte';
  import Check from '../lib/ui/Check.svelte';
  import { Player } from '../share/player.svelte';
  import { loadMap, loadRecipe, passes, type MapData, type MapMix } from '../lib/mapData';
  import { ringRows, type RingRow } from '../lib/shared';
  import { clockMarker } from '../lib/clockMarker';
  import { STUDIO_PATH } from '../lib/roundware';

  let data = $state.raw<MapData | null>(null);
  let failed = $state('');
  let chosen = $state.raw(new Set<number>());
  let selected = $state.raw<MapMix | null>(null);
  /** each mix's rows for its clock marker, as recipes arrive */
  let marks = $state.raw(new Map<number, RingRow[]>());
  let zoom = $state(2);
  let wide = $state(false);
  let wandering = $state(false);
  let scope = $state<'anywhere' | 'vox'>('anywhere');
  let filterDlg = $state<HTMLDialogElement>();
  let el: HTMLDivElement;
  let map: LMap | null = null;
  let layer: LayerGroup | null = null;
  let L: typeof import('leaflet') | null = null;
  /** the map is up (markers wait for it) */
  let ready = $state(false);
  const player = new Player();

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

  // the map itself, once
  $effect(() => {
    let gone = false;
    (async () => {
      L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (gone) return;
      map = L.map(el, { zoomControl: false, worldCopyJump: true, minZoom: 2 }).setView([30, 0], 2);
      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
      map.on('zoomend', () => (zoom = map!.getZoom()));
      zoom = map.getZoom();
      ready = true;
      if (untrack(() => data)) place();
    })();
    return () => {
      gone = true;
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
    if (!map || !data || !L) return;
    const want = Number(new URLSearchParams(location.search).get('m'));
    const m = data.mixes.find((x) => x.id === want);
    if (m) {
      selected = m;
      map.setView([m.latitude, m.longitude], 6);
    } else if (data.mixes.length) {
      map.fitBounds(L.latLngBounds(data.mixes.map((x) => [x.latitude, x.longitude])), { padding: [40, 40], maxZoom: 6 });
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
    if (!ready || !layer || !L || !data) return;
    const Lf = L;
    const show = visible;
    const sel = selected;
    const z = zoom;
    const mk = marks;
    layer.clearLayers();
    const ids = new Set(show.map((m) => m.id));
    // lines: from a vox's first shown mix to each of its others
    for (const fam of data.families.values()) {
      const f = fam.filter((m) => ids.has(m.id));
      if (f.length < 2) continue;
      const mine = sel?.voxId === f[0].voxId;
      for (const m of f.slice(1)) {
        Lf.polyline(
          [
            [f[0].latitude, f[0].longitude],
            [m.latitude, m.longitude],
          ],
          { color: mine ? '#ff5c80' : '#1d1b16', weight: mine ? 3 : 1.5, dashArray: mine ? undefined : '4 4', opacity: mine ? 1 : 0.7, interactive: false },
        ).addTo(layer);
      }
    }
    const clocks = z >= 5;
    // the selected one last, so it sits on top
    for (const m of [...show].sort((a, b) => Number(a.id === sel?.id) - Number(b.id === sel?.id))) {
      const on = m.id === sel?.id;
      const size = clocks ? (on ? 52 : 40) : on ? 18 : 12;
      const html = clocks
        ? clockMarker(mk.get(m.id) ?? null, { size, selected: on })
        : `<span class="bv-dot${on ? ' on' : ''}${m.revox ? ' revox' : ''}"></span>`;
      const marker = Lf.marker([m.latitude, m.longitude], {
        icon: Lf.divIcon({ className: 'bv-pin', html, iconSize: [size, size] }),
        title: m.title,
        keyboard: true,
        riseOnHover: true,
      });
      marker.on('click', () => pick(m, true));
      marker.addTo(layer);
    }
  });

  /** Show a mix's details; from a tap, play it too. */
  function pick(m: MapMix, play: boolean) {
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
    if (!map) return;
    const z = fly ? Math.max(map.getZoom(), 4) : map.getZoom();
    // wait a frame for the sheet to lay out
    requestAnimationFrame(() => {
      if (!map) return;
      const sheet = document.querySelector('.panel') as HTMLElement | null;
      const size = map.getSize();
      const shift = !sheet ? [0, 0] : wide ? [sheet.offsetWidth / 2, 0] : [0, Math.min(sheet.offsetHeight, size.y * 0.7) / 2];
      const pt = map.project([m.latitude, m.longitude], z).add(shift as [number, number]);
      const target = map.unproject(pt, z);
      if (fly) map.flyTo(target, z, { duration: 1.6 });
      else map.panTo(target);
    });
  }

  async function playMix(m: MapMix) {
    const r = await loadRecipe(data?.recipeUrls.get(m.id));
    const opts = wandering ? { loop: false, bpm: r?.bpm ?? 120, onend: next } : { loop: true, bpm: r?.bpm ?? 120 };
    void player.play(`mix${m.id}`, m.file, opts);
  }

  /** The detail's play button: stop it (and wandering), or play it. */
  function toggleSelected() {
    if (!selected) return;
    if (player.playing === `mix${selected.id}`) {
      player.stop();
      wandering = false;
    } else void playMix(selected);
  }

  // ── Wander ────────────────────────────────────────────────────────────

  function next() {
    const pool0 = scope === 'vox' && selected ? visible.filter((m) => m.voxId === selected!.voxId) : visible;
    const pool = pool0.length > 1 ? pool0.filter((m) => m.id !== selected?.id) : pool0;
    if (!pool.length) {
      wandering = false;
      return;
    }
    const m = pool[Math.floor(Math.random() * pool.length)];
    selected = m;
    reveal(m, true);
    void playMix(m);
  }

  function toggleWander() {
    if (wandering) {
      wandering = false;
      player.stop();
      return;
    }
    wandering = true;
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
    <span class="brand">BEATVOX</span>
    <div class="tools">
      <button class="btn" class:on={chosenCount > 0} onclick={() => filterDlg?.showModal()} aria-haspopup="dialog">
        FILTER{chosenCount ? ` · ${chosenCount}` : ''}
      </button>
      <a class="btn primary" href={STUDIO_PATH}>MAKE YOURS</a>
    </div>
  </header>

  <div class="map" bind:this={el} role="region" aria-label="Map of BeatVoxes"></div>

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
</div>

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
  }
  .map {
    flex: 1;
    background: #e9ebff;
    /* keep Leaflet's own layers (z-index 400+) below the bar and panel */
    position: relative;
    z-index: 0;
  }
  /* soften the map so the beats stand out */
  .map :global(.leaflet-tile-pane) {
    filter: grayscale(0.55) sepia(0.12) contrast(0.92) brightness(1.04);
  }
  .map :global(.bv-pin) {
    background: none;
    border: none;
  }
  .map :global(.bv-dot) {
    display: block;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border-radius: 50%;
    background: var(--blue);
    border: 2px solid var(--ink);
  }
  .map :global(.bv-dot.revox) {
    background: var(--yellow);
  }
  .map :global(.bv-dot.on) {
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
    gap: 10px;
    border-top: 2px solid var(--ink);
    background: var(--card);
    z-index: 2;
  }
  .bar.with-panel {
    margin-right: 400px;
  }
  .wander {
    min-width: 116px;
  }
  .scope {
    display: flex;
    border: 2px solid var(--ink);
    border-radius: 18px;
    overflow: hidden;
  }
  .scope button {
    min-height: 36px;
    padding: 0 10px;
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
    .brand {
      font-size: 22px;
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
