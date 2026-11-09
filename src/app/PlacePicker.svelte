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
        place = { latitude: round(e.lngLat.lat), longitude: round(e.lngLat.lng) };
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
    const c = map?.getCenter();
    // only once the map has been moved somewhere in particular
    return c && map!.getZoom() > 3 ? { latitude: c.lat, longitude: c.lng } : undefined;
  }

  function here() {
    if (!navigator.geolocation) {
      note = "This browser can't tell where you are. Tap the map instead.";
      return;
    }
    locating = true;
    note = '';
    navigator.geolocation.getCurrentPosition(
      (p) => {
        locating = false;
        place = { latitude: round(p.coords.latitude), longitude: round(p.coords.longitude) };
        query = '';
        map?.flyTo({ center: [place.longitude, place.latitude], zoom: 13 });
      },
      () => {
        locating = false;
        note = "Couldn't get your location. Tap the map instead.";
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
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
  {#if note}<p class="note">{note}</p>{/if}
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
</style>
