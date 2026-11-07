import { describe, it, expect } from 'vitest';
import { sliceSignal, DEFAULT_PARAMS } from './slicer';
import { slicePitch } from './pitch';

const SR = 44100;

/** Tone bursts like syllables: [startSec, durSec, hz] with a fast attack and slow decay. */
function bursts(spec: [number, number, number][], total = 3) {
  const x = new Float32Array(SR * total);
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const [t0, d, hz] of spec) {
    const a = Math.floor(t0 * SR), n = Math.floor(d * SR);
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / (0.005 * SR)) * Math.exp(-i / (0.4 * n));
      // consonant-like noise click at the start, then a voiced tone
      const click = i < 0.01 * SR ? rnd() * 0.6 : 0;
      x[a + i] += env * (0.5 * Math.sin((2 * Math.PI * hz * i) / SR) + 0.2 * Math.sin((4 * Math.PI * hz * i) / SR)) + click;
    }
  }
  return x;
}

const spec: [number, number, number][] = [[0.2, 0.25, 180], [0.7, 0.3, 220], [1.3, 0.2, 150], [1.8, 0.35, 260]];
const near = (got: number[], want: number[], tol: number) =>
  want.every((w) => got.some((g) => Math.abs(g - w) < tol));

describe('slicers', () => {
  const x = bursts(spec);
  for (const method of ['attacks', 'syllables', 'mixed'] as const) {
    it(`${method} finds each burst`, () => {
      const r = sliceSignal(x, SR, method, DEFAULT_PARAMS);
      expect(r.slices.length).toBe(4);
      expect(near(r.slices.map((s) => s.start), spec.map((s) => s[0]), 0.04)).toBe(true);
      for (const s of r.slices) expect(s.end - s.start).toBeLessThanOrEqual(1.5);
    });
  }
  it('returns nothing for silence', () => {
    expect(sliceSignal(new Float32Array(SR), SR, 'syllables', DEFAULT_PARAMS).slices.length).toBe(0);
  });
});

describe('pitch', () => {
  it('estimates tone pitch', () => {
    const x = bursts([[0, 0.5, 220]], 1);
    const p = slicePitch(x, SR, 0, 0.5);
    expect(p.hz).not.toBeNull();
    expect(Math.abs(p.hz! - 220)).toBeLessThan(5);
  });
});
