<script lang="ts">
  // A map of one vox and the beats made from it: the vox is a yellow diamond
  // where it was recorded, each beat a dot where it was made, with a line
  // from the vox to each. This beat is pink. Leaflet loads only when shown.
  import type { Map as LMap } from 'leaflet';
  import type { SharedMix } from '../lib/shared';

  interface Props {
    vox: { latitude: number; longitude: number };
    family: SharedMix[];
    current: number;
    /** pan and zoom (the overlay), or a still picture (the small map) */
    interactive?: boolean;
    onpick?: (id: number) => void;
  }
  let { vox, family, current, interactive = false, onpick }: Props = $props();

  let el: HTMLDivElement;

  $effect(() => {
    let map: LMap | null = null;
    let gone = false;
    (async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (gone) return;
      map = L.map(el, {
        zoomControl: interactive,
        attributionControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      const v: [number, number] = [vox.latitude, vox.longitude];
      const pts: [number, number][] = [v];
      for (const m of family) {
        const p: [number, number] = [m.latitude, m.longitude];
        pts.push(p);
        L.polyline([v, p], { color: '#1d1b16', weight: 2, dashArray: m.id === current ? undefined : '5 4' }).addTo(map);
      }
      // this beat's dot last, so it sits on top
      const top = (m: SharedMix) => (m.id === current ? 1 : 0);
      for (const m of [...family].sort((a, b) => top(a) - top(b))) {
        const dot = L.circleMarker([m.latitude, m.longitude], {
          radius: m.id === current ? 10 : 7,
          color: '#1d1b16',
          weight: 2,
          fillColor: m.id === current ? '#ff5c80' : '#2a35c9',
          fillOpacity: 1,
        }).addTo(map);
        if (interactive) {
          dot.bindTooltip(m.title);
          dot.on('click', () => onpick?.(m.id));
        }
      }
      L.marker(v, {
        interactive: false,
        icon: L.divIcon({ className: 'bv-vox', iconSize: [18, 18], html: '<span></span>' }),
      }).addTo(map);
      const bounds = L.latLngBounds(pts);
      if (bounds.getNorthEast().distanceTo(bounds.getSouthWest()) < 2000) map.setView(v, interactive ? 12 : 10);
      else map.fitBounds(bounds, { padding: interactive ? [40, 40] : [18, 18], maxZoom: 12 });
    })();
    return () => {
      gone = true;
      map?.remove();
    };
  });
</script>

<div class="map" class:still={!interactive} bind:this={el} aria-hidden={!interactive}></div>

<style>
  .map {
    width: 100%;
    height: 100%;
    background: #f7f4ea;
  }
  .still {
    pointer-events: none;
  }
  :global(.bv-vox span) {
    display: block;
    width: 14px;
    height: 14px;
    margin: 2px;
    box-sizing: border-box;
    background: var(--yellow);
    border: 2px solid var(--ink);
    transform: rotate(45deg);
  }
</style>
