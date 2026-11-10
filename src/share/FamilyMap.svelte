<script lang="ts">
  // A map of the beats made from one vox, each where its maker put it, with
  // a line from the first one (the original BeatVox) to each of the others
  // along the shortest route (as on the big map), pink as on the big map
  // when a family is chosen. This beat's dot is pink. Same riso style as the
  // home map, but flat; MapLibre loads only when this is shown.
  import type { Map as MlMap } from 'maplibre-gl';
  import type { SharedMix } from '../lib/shared';
  import { risoMap } from '../map/risoMap';
  import { greatCircle } from '../lib/greatCircle';

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
    // flat; the world repeats sideways so a route across the date line has land under it
    risoMap(el, { interactive, center: pts[0], zoom: 9, foldCredit: true, renderWorldCopies: true, globe: false, roads: false }).then(({ map: m, ml }) => {
      if (gone) return m.remove();
      map = m;
      map.on('load', () => {
        const arcs = family.slice(1).map((_, i) => greatCircle(pts[0], pts[i + 1]));
        // a dot sits where its arc ends, which may be a world along (past
        // ±180°) when the short way crosses the date line
        const at = new Map(family.map((f, i) => [f.id, i === 0 ? pts[0] : arcs[i - 1][arcs[i - 1].length - 1]]));
        const lines: GeoJSON.Feature[] = arcs.map((coordinates) => ({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates },
        }));
        // this beat's dot last, so it sits on top
        const dots: GeoJSON.Feature[] = [...family]
          .sort((a, b) => Number(a.id === current) - Number(b.id === current))
          .map((f) => ({ type: 'Feature', properties: { id: f.id, title: f.title, here: f.id === current }, geometry: { type: 'Point', coordinates: at.get(f.id)! } }));
        map!.addSource('lines', { type: 'geojson', data: { type: 'FeatureCollection', features: lines } });
        map!.addSource('dots', { type: 'geojson', data: { type: 'FeatureCollection', features: dots } });
        // every line here is this vox's family, so they're drawn as the home
        // map draws the chosen family: solid pink
        map!.addLayer({ id: 'lines', type: 'line', source: 'lines', paint: { 'line-color': '#ff5c80', 'line-width': 3 } });
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
        // frame the dots and the whole of each route, which can rise well
        // above both dots; if the routes would take it out past one world
        // wide (a family all over the world, in a short box), just the dots,
        // the long routes running off the top; the world never repeats
        const dotsBox = new ml.LngLatBounds();
        for (const p of at.values()) dotsBox.extend(p);
        const all = new ml.LngLatBounds(dotsBox.getSouthWest(), dotsBox.getNorthEast());
        for (const l of lines) for (const p of (l.geometry as GeoJSON.LineString).coordinates) all.extend(p as [number, number]);
        const ne = dotsBox.getNorthEast();
        const sw = dotsBox.getSouthWest();
        const pad = interactive ? 40 : 18;
        const oneWorld = Math.log2(el.clientWidth / 512);
        if (Math.abs(ne.lng - sw.lng) + Math.abs(ne.lat - sw.lat) < 0.02) map!.jumpTo({ center: pts[0], zoom: interactive ? 4.5 : 3.5 }); // where in the world, not the street
        else {
          map!.fitBounds(all, { padding: pad, maxZoom: 11, duration: 0 });
          if (map!.getZoom() < oneWorld) map!.fitBounds(dotsBox, { padding: pad, maxZoom: 11, duration: 0 });
          // still more than one world (dots far north and south): one world,
          // centred on them, so nothing shows twice
          if (map!.getZoom() < oneWorld) map!.jumpTo({ center: dotsBox.getCenter(), zoom: oneWorld });
        }
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
