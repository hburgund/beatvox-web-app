// A MapLibre style in BeatVox's riso look, for OpenStreetMap vector tiles in
// the OpenMapTiles schema (OpenFreeMap here; MapTiler and self-hosted tiles
// use the same layers). Paper land, riso-blue water with a halftone dot, ink
// coastlines, very few roads and labels, so the beats are the color on it.

export interface RisoColors {
  paper: string;
  water: string;
  dots: string;
  ink: string;
  park: string;
  road: string;
  label: string;
  halo: string;
}

export const RISO_LIGHT: RisoColors = {
  paper: '#f4efe2',
  water: '#cdd2f6',
  dots: 'rgba(42,53,201,0.35)',
  ink: '#1d1b16',
  park: '#e6e8cf',
  road: '#ddd3bb',
  label: '#5d584c',
  halo: '#f4efe2',
};

export const RISO_DARK: RisoColors = {
  paper: '#1d1b16',
  water: '#1f2a8f',
  dots: 'rgba(255,210,63,0.28)',
  ink: '#f4efe2',
  park: '#25261c',
  road: '#3a362c',
  label: '#ffd23f',
  halo: '#1d1b16',
};

const TILES = 'https://tiles.openfreemap.org/planet';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
/** the credit the tiles' terms require (OpenFreeMap's part is optional but kind) */
export const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

/** A halftone dot to fill the water with (added as the image "halftone"). */
export function halftone(color: string, size = 8, r = 1.3): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.beginPath();
  g.arc(size / 4, size / 4, r, 0, Math.PI * 2);
  g.arc((size * 3) / 4, (size * 3) / 4, r, 0, Math.PI * 2);
  g.fill();
  return g.getImageData(0, 0, size, size);
}

const upper = ['upcase', ['coalesce', ['get', 'name:en'], ['get', 'name']]];

export function risoStyle(C: RisoColors, opts: { globe?: boolean; roads?: boolean } = {}) {
  const roads = opts.roads ?? true;
  return {
    version: 8,
    glyphs: GLYPHS,
    ...(opts.globe ? { projection: { type: 'globe' } } : {}),
    sources: { omt: { type: 'vector', url: TILES, attribution: ATTRIBUTION } },
    layers: [
      { id: 'paper', type: 'background', paint: { 'background-color': C.paper } },
      { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', paint: { 'fill-color': C.park } },
      {
        id: 'wood',
        type: 'fill',
        source: 'omt',
        'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['wood', 'grass'], true, false],
        paint: { 'fill-color': C.park, 'fill-opacity': 0.55 },
      },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': C.water } },
      { id: 'water-dots', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-pattern': 'halftone' } },
      {
        id: 'coast',
        type: 'line',
        source: 'omt',
        'source-layer': 'water',
        paint: { 'line-color': C.ink, 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1, 12, 1.6] },
      },
      {
        id: 'rivers',
        type: 'line',
        source: 'omt',
        'source-layer': 'waterway',
        minzoom: 6,
        paint: { 'line-color': C.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 12, 2] },
      },
      ...(roads
        ? [
            {
              id: 'roads-minor',
              type: 'line',
              source: 'omt',
              'source-layer': 'transportation',
              minzoom: 11,
              filter: ['match', ['get', 'class'], ['secondary', 'tertiary', 'minor'], true, false],
              paint: { 'line-color': C.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 4] },
            },
            {
              id: 'roads-major',
              type: 'line',
              source: 'omt',
              'source-layer': 'transportation',
              minzoom: 5,
              filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
              paint: { 'line-color': C.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 10, 1.6, 16, 6] },
            },
          ]
        : []),
      {
        id: 'states',
        type: 'line',
        source: 'omt',
        'source-layer': 'boundary',
        minzoom: 3,
        filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
        paint: { 'line-color': C.ink, 'line-opacity': 0.25, 'line-width': 0.6, 'line-dasharray': [1, 2] },
      },
      {
        id: 'borders',
        type: 'line',
        source: 'omt',
        'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
        paint: { 'line-color': C.ink, 'line-opacity': 0.5, 'line-width': 0.8, 'line-dasharray': [3, 2] },
      },
      {
        id: 'countries',
        type: 'symbol',
        source: 'omt',
        'source-layer': 'place',
        maxzoom: 6,
        filter: ['==', ['get', 'class'], 'country'],
        layout: { 'text-field': upper, 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-letter-spacing': 0.25, 'text-max-width': 8 },
        paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 1.5 },
      },
      {
        id: 'cities',
        type: 'symbol',
        source: 'omt',
        'source-layer': 'place',
        minzoom: 3.5,
        filter: ['any', ['==', ['get', 'class'], 'city'], ['all', ['==', ['get', 'class'], 'town'], ['>=', ['zoom'], 8]]],
        layout: {
          'text-field': upper,
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 12, 12],
          'text-letter-spacing': 0.15,
          'symbol-sort-key': ['get', 'rank'],
        },
        paint: { 'text-color': C.label, 'text-halo-color': C.halo, 'text-halo-width': 1.5 },
      },
    ],
  };
}
