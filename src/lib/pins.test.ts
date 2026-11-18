import { describe, expect, it } from 'vitest';
import { Pins, fanOffsets } from './pins';

const mix = (id: number, longitude: number, latitude: number) => ({ id, longitude, latitude });
// Boston-ish, a few km apart; one in the same spot as another; one far away
const boston = [mix(1, -71.06, 42.36), mix(2, -71.1, 42.37), mix(3, -71.06, 42.36), mix(4, -71.0, 42.33)];
const augusta = mix(5, -69.78, 44.31);
const all = [...boston, augusta];

describe('map pins', () => {
  it('stacks mixes whose markers would overlap, and leaves the rest alone', () => {
    const pins = new Pins(all).at(6, true);
    const stacks = pins.filter((p) => p.kind === 'stack');
    expect(stacks).toHaveLength(1);
    expect(stacks[0].kind === 'stack' && stacks[0].mixes.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(pins.some((p) => p.kind === 'mix' && p.mix.id === 5)).toBe(true);
  });

  it('comes apart as you zoom in, except mixes in the same spot', () => {
    const p = new Pins(all);
    const stack = p.at(6, true).find((x) => x.kind === 'stack')!;
    expect(stack.kind === 'stack' && stack.expansionZoom).toBeGreaterThan(6);
    const deep = p.at(16, true).filter((x) => x.kind === 'stack');
    expect(deep).toHaveLength(1);
    // the two in the very same spot can only fan out
    expect(deep[0].kind === 'stack' && deep[0].mixes.map((m) => m.id)).toEqual([1, 3]);
    expect(deep[0].kind === 'stack' && deep[0].expansionZoom).toBe(Infinity);
  });

  it('dots stack less readily than clocks', () => {
    const p = new Pins(all);
    const z = 9;
    const n = (clocks: boolean) => p.at(z, clocks).filter((x) => x.kind === 'stack').length;
    const sizes = (clocks: boolean) => p.at(z, clocks).map((x) => (x.kind === 'stack' ? x.mixes.length : 1));
    expect(Math.max(...sizes(false))).toBeLessThanOrEqual(Math.max(...sizes(true)));
    expect(n(true)).toBeGreaterThan(0);
  });

  it('zooms in far enough for a stack of dots not to stack again as clocks', () => {
    const p = new Pins(all);
    const clocksAt = (z: number) => z >= 4;
    for (const z of [1, 2, 3, 4, 6]) {
      for (const s of p.at(z, clocksAt(z), clocksAt)) {
        if (s.kind !== 'stack' || s.expansionZoom === Infinity) continue;
        const after = p.at(s.expansionZoom, clocksAt(s.expansionZoom), clocksAt);
        expect(after.some((q) => q.kind === 'stack' && s.mixes.every((m) => q.mixes.includes(m)))).toBe(false);
      }
    }
  });

  it('never stacks the open mix and its family', () => {
    const pins = new Pins(all, new Set([1, 3])).at(6, true);
    const loose = pins.filter((p) => p.kind === 'mix').map((p) => p.kind === 'mix' && p.mix.id);
    expect(loose).toEqual(expect.arrayContaining([1, 3, 5]));
    // and they're drawn last, on top
    expect(pins.slice(-2).map((p) => p.kind === 'mix' && p.mix.id)).toEqual([1, 3]);
  });

  it('fans out in a ring with room for each marker', () => {
    const o = fanOffsets(6, 40);
    expect(o).toHaveLength(6);
    expect(o[0][0]).toBe(0);
    expect(o[0][1]).toBeLessThan(0); // the first at the top
    for (let i = 0; i < o.length; i++)
      for (let j = i + 1; j < o.length; j++) expect(Math.hypot(o[i][0] - o[j][0], o[i][1] - o[j][1])).toBeGreaterThanOrEqual(40);
    // a big stack gets a second ring
    const big = fanOffsets(14, 40);
    expect(Math.hypot(...big[12])).toBeGreaterThan(Math.hypot(...big[2]));
  });
});
