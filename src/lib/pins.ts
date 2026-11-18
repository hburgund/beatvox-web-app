// Which mixes the map draws on their own and which it gathers into a stack,
// at a zoom. Supercluster (what MapLibre clusters with) groups mixes whose
// markers would overlap: dots zoomed out, clocks zoomed in, so each has its
// own reach. A stack zooms in to come apart; mixes in the same spot, which
// no zoom pulls apart, fan out instead (see fanOffsets).
import Supercluster from 'supercluster';

export interface PinMix {
  id: number;
  latitude: number;
  longitude: number;
}

export type Pin<M extends PinMix> =
  | { kind: 'mix'; mix: M }
  | {
      kind: 'stack';
      /** stable for this set of mixes at this zoom */
      key: string;
      longitude: number;
      latitude: number;
      /** in the order they were given (the map's: newest first) */
      mixes: M[];
      /** the zoom where it comes apart (in whatever markers that zoom shows); Infinity: only a fan-out will */
      expansionZoom: number;
    };

/**
 * How close (px) markers can get before they stack: a dot is 12px, a clock 40,
 * a stack 24 (34 among the clocks). Supercluster measures on the flat (Mercator) map, but
 * zoomed out the map is a globe, where places away from the equator sit
 * closer together (by cos(latitude): about 0.7 at 45°), so the dots' reach
 * allows for that.
 */
export const STACK_REACH = { dots: 34, clocks: 42 };

export class Pins<M extends PinMix> {
  private dots: Supercluster<{ i: number }>;
  private clocks: Supercluster<{ i: number }>;
  private loose: M[];
  private grouped: M[];

  /** `mixes` in drawing order; `loose` ids are never stacked (the open mix's family) */
  constructor(
    mixes: M[],
    loose: Set<number> = new Set(),
    readonly maxZoom = 16,
  ) {
    this.loose = mixes.filter((m) => loose.has(m.id));
    this.grouped = mixes.filter((m) => !loose.has(m.id));
    const points = this.grouped.map((m, i) => ({
      type: 'Feature' as const,
      properties: { i },
      geometry: { type: 'Point' as const, coordinates: [m.longitude, m.latitude] },
    }));
    // clustered up to the map's deepest zoom, so a same-spot stack stays a stack there
    const make = (radius: number) => new Supercluster<{ i: number }>({ radius, maxZoom, minPoints: 2 }).load(points);
    this.dots = make(STACK_REACH.dots);
    this.clocks = make(STACK_REACH.clocks);
  }

  /**
   * What to draw at `zoom`, with clocks (zoomed in) or dots. Loose mixes come
   * last, on top. `clocksAt` says which markers deeper zooms show, so a stack
   * knows where it really comes apart (dots stack less readily than clocks).
   */
  at(zoom: number, clocks: boolean, clocksAt: (z: number) => boolean = () => clocks): Pin<M>[] {
    return this.raw(zoom, clocks).map((p) => (p.kind === 'stack' ? { ...p, expansionZoom: this.splitZoom(p, Math.floor(zoom), clocksAt) } : p));
  }

  /** the first zoom past `from` where a stack's mixes aren't all in one stack any more */
  private splitZoom(p: Extract<Pin<M>, { kind: 'stack' }>, from: number, clocksAt: (z: number) => boolean): number {
    for (let z = Math.max(from + 1, p.expansionZoom); z <= this.maxZoom; z++) {
      const still = this.raw(z, clocksAt(z)).some((q) => q.kind === 'stack' && p.mixes.every((m) => q.mixes.includes(m)));
      if (!still) return z;
    }
    return Infinity;
  }

  /** what supercluster gives at each zoom, kept: the same set is asked for again and again */
  private seen = new Map<string, Pin<M>[]>();

  private raw(zoom: number, clocks: boolean): Pin<M>[] {
    const index = clocks ? this.clocks : this.dots;
    const z = Math.min(this.maxZoom, Math.floor(zoom));
    const kept = this.seen.get(`${clocks}${z}`);
    if (kept) return kept;
    const out: Pin<M>[] = [];
    for (const f of index.getClusters([-180, -90, 180, 90], z)) {
      const p = f.properties as { cluster?: boolean; cluster_id?: number; i?: number };
      if (!p.cluster) {
        out.push({ kind: 'mix', mix: this.grouped[p.i!] });
        continue;
      }
      const id = p.cluster_id!;
      const mixes = index
        .getLeaves(id, Infinity)
        .map((l) => this.grouped[l.properties.i])
        .sort((a, b) => this.grouped.indexOf(a) - this.grouped.indexOf(b));
      const [longitude, latitude] = f.geometry.coordinates;
      out.push({
        kind: 'stack',
        key: `${clocks ? 'c' : 'd'}${z}:${mixes.map((m) => m.id).join(',')}`,
        longitude,
        latitude,
        mixes,
        expansionZoom: index.getClusterExpansionZoom(id),
      });
    }
    for (const m of this.loose) out.push({ kind: 'mix', mix: m });
    this.seen.set(`${clocks}${z}`, out);
    return out;
  }
}

/**
 * Where each of `n` markers goes when a stack fans out, in px from its
 * centre: a ring that leaves `size` px per marker, starting at the top.
 * Past 10 a second, wider ring.
 */
export function fanOffsets(n: number, size: number): [number, number][] {
  const out: [number, number][] = [];
  const PER_RING = 10;
  for (let k = 0; k < n; k++) {
    const ring = Math.floor(k / PER_RING);
    const inRing = Math.min(PER_RING, n - ring * PER_RING);
    const j = k % PER_RING;
    const r = Math.max(size * 1.1, (inRing * size * 1.15) / (2 * Math.PI)) + ring * size * 1.2;
    const a = (j / inRing) * 2 * Math.PI + ring * 0.3;
    out.push([Math.round(r * Math.sin(a)), Math.round(-r * Math.cos(a))]);
  }
  return out;
}
