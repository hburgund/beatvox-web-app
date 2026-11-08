<script lang="ts">
  // A small map: tap anywhere to put your BeatVox there, or use "where I
  // am". Leaflet is loaded only when this appears, to keep the app light.
  import type { Map as LMap, CircleMarker } from 'leaflet';
  import { untrack } from 'svelte';
  import type { RwPlace } from '../lib/roundware';

  let {
    place = $bindable(),
    center,
  }: { place: RwPlace | null; center: RwPlace } = $props();

  let el: HTMLDivElement;
  let map: LMap | null = null;
  let pin: CircleMarker | null = null;
  let ready = $state(false);
  let locating = $state(false);
  let note = $state('');

  const round = (x: number) => Math.round(x * 1e5) / 1e5;

  $effect(() => {
    let gone = false;
    (async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (gone) return;
      const start = untrack(() => place);
      map = L.map(el, { zoomControl: true, attributionControl: true }).setView(
        start ? [start.latitude, start.longitude] : [center.latitude, center.longitude],
        start ? 13 : 3,
      );
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      pin = L.circleMarker([0, 0], { radius: 9, color: '#000', weight: 2, fillColor: '#e33', fillOpacity: 1 });
      if (start) pin.setLatLng([start.latitude, start.longitude]).addTo(map);
      ready = true;
      map.on('click', (e) => {
        place = { latitude: round(e.latlng.lat), longitude: round(e.latlng.lng) };
        note = '';
      });
    })();
    return () => {
      gone = true;
      map?.remove();
      map = null;
    };
  });

  // keep the pin where the place is
  $effect(() => {
    if (!ready || !map || !pin) return;
    if (place) pin.setLatLng([place.latitude, place.longitude]).addTo(map);
    else pin.remove();
  });

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
        map?.setView([place.latitude, place.longitude], 14);
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
    <button class="pill" onclick={here} disabled={locating}>{locating ? 'FINDING…' : 'WHERE I AM'}</button>
    <span class="hint">{place ? `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}` : 'or tap the map anywhere'}</span>
  </div>
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
  .row .pill {
    min-width: 108px;
    flex: none;
  }
  .hint {
    font: 12px var(--bv-mono);
  }
  .map {
    height: 220px;
    border: 1px solid #888;
    border-radius: 6px;
    background: #ddd;
    z-index: 0;
  }
  .note {
    margin: 0;
    font-size: 12px;
    color: #a00;
  }
</style>
