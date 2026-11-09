<script lang="ts">
  // A map of the beats made from one vox, each where its maker put it, with
  // a line from the first one (the original BeatVox) to each of the others,
  // as on the big map. This beat is pink. Leaflet loads only when shown.
  import type { Map as LMap } from 'leaflet';
  import type { SharedMix } from '../lib/shared';

  interface Props {
    family: SharedMix[];
    current: number;
    /** pan and zoom (the overlay), or a still picture (the small map) */
    interactive?: boolean;
    onpick?: (id: number) => void;
  }
  let { family, current, interactive = false, onpick }: Props = $props();

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
      const pts: [number, number][] = family.map((m) => [m.latitude, m.longitude]);
      const first = pts[0];
      family.slice(1).forEach((m, i) => {
        const solid = m.id === current || family[0].id === current;
        L.polyline([first, pts[i + 1]], { color: '#1d1b16', weight: 2, dashArray: solid ? undefined : '5 4' }).addTo(map!);
      });
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
      if (!pts.length) return;
      const bounds = L.latLngBounds(pts);
      if (bounds.getNorthEast().distanceTo(bounds.getSouthWest()) < 2000) map.setView(first, interactive ? 12 : 10);
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

</style>
