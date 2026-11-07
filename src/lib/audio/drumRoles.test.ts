import { describe, expect, it } from 'vitest';
import { bestRole, matchSlices, roleScores, sliceTraits } from './drumRoles';
import { highpass } from './prepare';
import { Rng } from './rng';
import type { Slice } from './slicer';

const SR = 44100;

// Four made-up "voice" sounds, 0.5 s apart.
function testSignal() {
  const x = new Float32Array(SR * 2.2);
  const rng = new Rng(3);
  const put = (at: number, len: number, f: (t: number, i: number) => number) => {
    const a = Math.floor(at * SR);
    for (let i = 0; i < len * SR; i++) x[a + i] = f(i / SR, i);
  };
  // kick: 70 Hz thump with a quick pitch drop, ~250 ms
  put(0.05, 0.25, (t) => Math.sin(2 * Math.PI * (60 + 60 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9) * 0.9);
  // hat: bright hiss, 60 ms
  const hiss = new Float32Array(Math.floor(0.06 * SR)).map(() => rng.range(-1, 1));
  highpass(hiss, SR, 6000);
  highpass(hiss, SR, 6000);
  put(0.6, 0.06, (t, i) => hiss[i] * Math.exp(-t * 40) * 0.8);
  // snare: broadband noise with a fast attack, 150 ms
  const noise = new Float32Array(Math.floor(0.15 * SR)).map(() => rng.range(-1, 1));
  highpass(noise, SR, 900);
  put(1.1, 0.15, (t, i) => noise[i] * Math.exp(-t * 18) * 0.9);
  // tonal: a sung "ah" at 180 Hz with harmonics, 400 ms
  put(1.6, 0.4, (t) => {
    let v = 0;
    for (let h = 1; h <= 8; h++) v += Math.sin(2 * Math.PI * 180 * h * t) / h;
    return v * 0.35 * Math.min(1, t * 40) * Math.min(1, (0.4 - t) * 20);
  });
  const slices: Slice[] = [
    { start: 0.05, end: 0.3, peakDb: -1 },
    { start: 0.6, end: 0.66, peakDb: -3 },
    { start: 1.1, end: 1.25, peakDb: -2 },
    { start: 1.6, end: 2.0, peakDb: -4 },
  ];
  return { x, slices };
}

describe('drum roles', () => {
  const { x, slices } = testSignal();
  const traits = slices.map((s) => sliceTraits(x, SR, s));
  const scores = roleScores(traits);

  it('measures sensible traits', () => {
    expect(traits[0].centroid).toBeLessThan(traits[1].centroid);
    expect(traits[1].high).toBeGreaterThan(0.5);
    expect(traits[2].flatness).toBeGreaterThan(traits[3].flatness);
    expect(traits[3].voiced).toBeGreaterThan(0.5);
  });

  it('picks the low thump as the kick and the hiss as the hat', () => {
    expect(bestRole(scores[0])).toBe('kick');
    expect(bestRole(scores[1])).toBe('hat');
    expect(bestRole(scores[3])).toBe('tonal');
  });

  it('matches each wanted role to its own best slice', () => {
    const picks = matchSlices(scores, ['kick', 'snare', 'hat', 'tonal'], new Set());
    expect(picks).toEqual([0, 2, 1, 3]);
    expect(matchSlices(scores, ['kick', 'any', null], new Set([0]))).toEqual([expect.any(Number), -1, -1]);
    expect(matchSlices(scores, ['kick'], new Set([0]))[0]).not.toBe(0);
  });
});
