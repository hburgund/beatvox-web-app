<script lang="ts">
  // A map of the beats made from one vox, each where its maker put it, with
  // a line from the first one (the original BeatVox) to each of the others,
  // as on the big map. This beat is pink. Same riso style as the home map;
  // MapLibre loads only when this is shown.
  import type { Map as MlMap } from 'maplibre-gl';
  import type { SharedMix } from '../lib/shared';
  import { risoMap } from '../map/risoMap';

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
    let map: MlMap | null = null;
    let gone = false;
    const pts = family.map((m) => [m.longitude, m.latitude] as [number, number]);
    if (!pts.length) return;
    risoMap(el, { interactive, center: pts[0], zoom: 9, foldCredit: true }).then(({ map: m, ml }) => {
      if (gone) return m.remove();
      map = m;
      map.on('load', () => {
        const lines: GeoJSON.Feature[] = family.slice(1).map((f, i) => ({
          type: 'Feature',
          properties: { solid: f.id === current || family[0].id === current },
          geometry: { type: 'LineString', coordinates: [pts[0], pts[i + 1]] },
        }));
        // this beat's dot last, so it sits on top
        const dots: GeoJSON.Feature[] = [...family]
          .sort((a, b) => Number(a.id === current) - Number(b.id === current))
          .map((f) => ({ type: 'Feature', properties: { id: f.id, title: f.title, here: f.id === current }, geometry: { type: 'Point', coordinates: [f.longitude, f.latitude] } }));
        map!.addSource('lines', { type: 'geojson', data: { type: 'FeatureCollection', features: lines } });
        map!.addSource('dots', { type: 'geojson', data: { type: 'FeatureCollection', features: dots } });
        map!.addLayer({ id: 'lines', type: 'line', source: 'lines', paint: { 'line-color': '#1d1b16', 'line-width': 2, 'line-dasharray': ['case', ['get', 'solid'], ['literal', [1, 0]], ['literal', [3, 2]]] } });
        map!.addLayer({
          id: 'dots',
          type: 'circle',
          source: 'dots',
          paint: {
            'circle-radius': ['case', ['get', 'here'], 9, 6],
            'circle-color': ['case', ['get', 'here'], '#ff5c80', '#2a35c9'],
            'circle-stroke-color': '#1d1b16',
            'circle-stroke-width': 2,
          },
        });
        if (interactive) {
          map!.on('click', 'dots', (e) => {
            const id = e.features?.[0]?.properties?.id;
            if (typeof id === 'number') onpick?.(id);
          });
          map!.on('mouseenter', 'dots', () => (map!.getCanvas().style.cursor = 'pointer'));
          map!.on('mouseleave', 'dots', () => (map!.getCanvas().style.cursor = ''));
        }
        const b = new ml.LngLatBounds();
        pts.forEach((p) => b.extend(p));
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        if (Math.abs(ne.lng - sw.lng) + Math.abs(ne.lat - sw.lat) < 0.02) map!.jumpTo({ center: pts[0], zoom: interactive ? 11 : 9 });
        else map!.fitBounds(b, { padding: interactive ? 40 : 18, maxZoom: 11, duration: 0 });
      });
    });
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
    background: var(--paper);
  }
  .still {
    pointer-events: none;
  }
</style>
