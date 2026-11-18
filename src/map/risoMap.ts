// Make a MapLibre map in BeatVox's riso style. MapLibre loads only when a
// map is shown, so the studio and share pages stay light until then.
import type { Map as MlMap, MapOptions } from 'maplibre-gl';
import { halftone, risoStyle, RISO_LIGHT, type RisoColors } from './risoStyle';

export type Maplibre = typeof import('maplibre-gl');

export async function risoMap(
  container: HTMLElement,
  opts: Partial<MapOptions> & {
    globe?: boolean;
    roads?: boolean;
    colors?: RisoColors;
    /** small maps: start with the credit folded into its (i) button */
    foldCredit?: boolean;
  } = {},
): Promise<{ map: MlMap; ml: Maplibre }> {
  const ml = await import('maplibre-gl');
  await import('maplibre-gl/dist/maplibre-gl.css');
  // MapLibre 6 looks for its worker beside its own file, which a bundled build
  // doesn't keep; give it the copy the build ships instead
  ml.setWorkerUrl((await import('maplibre-gl/dist/maplibre-gl-worker.mjs?url')).default);
  const { globe = false, roads = true, colors = RISO_LIGHT, foldCredit = false, ...rest } = opts;
  const map = new ml.Map({
    container,
    // the style object matches MapLibre's StyleSpecification; it's built loosely typed
    style: risoStyle(colors, { globe, roads }) as never,
    attributionControl: { compact: true },
    ...rest,
  });
  // the sea's halftone dots, made when the style first asks for them
  map.setMissingStyleImageResolver((id) => {
    if (id === 'halftone' && !map.hasImage('halftone')) map.addImage('halftone', halftone(colors.dots));
  });
  if (foldCredit) {
    map.once('load', () => container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
  }
  return { map, ml };
}
