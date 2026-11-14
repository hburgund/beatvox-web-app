<script lang="ts">
  // Where your BeatVox goes on the map: search for a place, use "where I
  // am", or tap the map anywhere. Same riso map as the home page; MapLibre
  // loads only when this appears.
  import type { Map as MlMap, Marker } from 'maplibre-gl';
  import { risoMap } from '../map/risoMap';
  import { untrack } from 'svelte';
  import PlaceSearch from '../lib/ui/PlaceSearch.svelte';
  import type { FoundPlace } from '../lib/geocode';
  import type { RwPlace } from '../lib/roundware';

  let {
    place = $bindable(),
    center,
  }: { place: RwPlace | null; center: RwPlace } = $props();

  let el: HTMLDivElement;
  let map: MlMap | null = null;
  let pin: Marker | null = null;
  let ready = $state(false);
  let locating = $state(false);
  let note = $state('');
  /** the note is news, not a problem */
  let fyi = $state(false);
  /** the search box's text, cleared when the pin moves another way */
  let query = $state('');

  const round = (x: number) => Math.round(x * 1e5) / 1e5;

  $effect(() => {
    let gone = false;
    const start = untrack(() => place);
    risoMap(el, {
      center: start ? [start.longitude, start.latitude] : [center.longitude, center.latitude],
      zoom: start ? 12 : 2,
      maxZoom: 16,
      foldCredit: true,
    }).then(({ map: m, ml }) => {
      if (gone) return m.remove();
      map = m;
      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      const dot = document.createElement('span');
      dot.className = 'pin';
      pin = new ml.Marker({ element: dot });
      ready = true;
      map.on('click', (e) => {
        // the flat map repeats sideways: a tap on a copy is still -180..180
        const p = e.lngLat.wrap();
        place = { latitude: round(p.lat), longitude: round(p.lng) };
        query = '';
        note = '';
      });
    });
    return () => {
      gone = true;
      map?.remove();
      map = null;
    };
  });

  // keep the pin where the place is
  $effect(() => {
    if (!ready || !map || !pin) return;
    if (place) pin.setLngLat([place.longitude, place.latitude]).addTo(map);
    else pin.remove();
  });

  /** A place picked from the search: pin it and show its area. */
  function found(p: FoundPlace) {
    place = { latitude: round(p.latitude), longitude: round(p.longitude) };
    note = '';
    if (!map) return;
    if (p.extent) {
      const [w, n, e, s] = p.extent;
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 30, maxZoom: 14, duration: 1200 },
      );
    } else map.flyTo({ center: [p.longitude, p.latitude], zoom: 13, duration: 1200 });
  }

  function near() {
    const c = map?.getCenter().wrap();
    // only once the map has been moved somewhere in particular
    return c && map!.getZoom() > 3 ? { latitude: c.lat, longitude: c.lng } : undefined;
  }

  /** Pin a place and show it close up. */
  function pinAt(latitude: number, longitude: number, zoom: number) {
    place = { latitude: round(latitude), longitude: round(longitude) };
    query = '';
    map?.flyTo({ center: [place.longitude, place.latitude], zoom });
  }

  /**
   * Roughly where they are (their city, more or less), from their connection
   * (netlify/edge-functions/where.ts), for when the browser can't say. Only
   * on the live site; null if it can't tell.
   */
  async function roughly(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const r = await fetch('/api/where', { cache: 'no-store' });
      if (!r.ok || !r.headers.get('content-type')?.includes('json')) return null;
      const w = await r.json();
      return w && typeof w.latitude === 'number' && typeof w.longitude === 'number' ? w : null;
    } catch {
      return null;
    }
  }

  /** The browser couldn't find them (but wasn't told no): use the rough place, or say so. */
  async function fallBack(why: string) {
    const r = await roughly();
    locating = false;
    if (r) {
      pinAt(r.latitude, r.longitude, 10);
      note = 'This is roughly where you are. Tap the map to put it right where you want.';
      fyi = true;
    } else note = why;
  }

  function here() {
    locating = true;
    note = '';
    fyi = false;
    if (!navigator.geolocation) {
      void fallBack("This browser can't tell where you are. Tap the map instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        locating = false;
        pinAt(p.coords.latitude, p.coords.longitude, 13);
      },
      (e) => {
        // refused: respect that, no guessing. Otherwise (a laptop can be very
        // slow to find itself, or have no idea) fall back to roughly.
        if (e.code === e.PERMISSION_DENIED) {
          locating = false;
          note = 'Location is blocked for this site. Allow it in your browser, or tap the map instead.';
        } else
          void fallBack(
            e.code === e.TIMEOUT
              ? 'Finding your location took too long. Try again, or tap the map instead.'
              : "Your device couldn't find where you are. Check that Location Services is on for this browser, or tap the map instead.",
          );
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 },
    );
  }
</script>

<div class="picker">
  <div class="row">
    <button class="btn" onclick={here} disabled={locating}>{locating ? 'FINDING…' : 'WHERE I AM'}</button>
    <span class="hint">{place ? `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}` : 'or search, or tap the map'}</span>
  </div>
  <PlaceSearch {near} onpick={found} bind:query />
  <div class="map" bind:this={el}></div>
  {#if note}<p class="note" class:fyi>{note}</p>{/if}
</div>

<style>
  .picker {
    display: grid;
    gap: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .row .btn {
    flex: none;
  }
  .hint {
    font: 12px var(--mono);
    color: var(--muted);
  }
  .map {
    height: 220px;
    border: 2px solid var(--ink);
    border-radius: 8px;
    background: var(--paper);
    overflow: hidden;
    position: relative;
    z-index: 0;
  }
  .map :global(.pin) {
    display: block;
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    border-radius: 50%;
    background: var(--pink);
    border: 2px solid var(--ink);
  }
  .note {
    margin: 0;
    font-size: 12px;
    color: var(--error);
  }
  .note.fyi {
    color: var(--muted);
  }
</style>
