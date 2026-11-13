import { describe, expect, it } from 'vitest';
import { level, limit, LEVEL, normalize, voiceLoudness } from './prepare';

const SR = 8000;
const peakOf = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
const rmsDb = (x: Float32Array) => 10 * Math.log10(x.reduce((s, v) => s + v * v, 0) / x.length);

/** `voice` seconds of a tone at `amp`, with silence (low noise) around it, and an optional spike. */
function take(amp: number, opts: { spike?: number; noise?: number } = {}) {
  const x = new Float32Array(SR * 3);
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < x.length; i++) x[i] = (opts.noise ?? 0.0005) * rnd();
  for (let i = SR; i < SR * 2; i++) x[i] += amp * Math.sin((2 * Math.PI * 220 * i) / SR);
  if (opts.spike) for (let i = 0; i < 40; i++) x[SR + 100 + i] = opts.spike * (i % 2 ? 1 : -1);
  return x;
}

describe('voiceLoudness', () => {
  it('measures the voice, not the silence around it', () => {
    const x = take(0.1);
    // a sine at 0.1 is about -23 dBFS RMS, whatever the silence
    expect(voiceLoudness(x, SR)).toBeCloseTo(rmsDb(x.subarray(SR, SR * 2)), 0);
  });
  it('is -Infinity for nothing at all', () => {
    expect(voiceLoudness(new Float32Array(SR), SR)).toBe(-Infinity);
  });
});

describe('limit', () => {
  it('keeps every sample under the ceiling and leaves quiet audio alone', () => {
    const x = take(0.3, { spike: 3 });
    const later = x.slice(SR + 5000, SR + 6000);
    limit(x, SR, 0.95);
    expect(peakOf(x)).toBeLessThanOrEqual(0.95);
    // once it has let go (80 ms release), the voice is as it was, within 1%
    const after = x.slice(SR + 5000, SR + 6000);
    for (let i = 0; i < later.length; i++) expect(Math.abs(after[i] - later[i])).toBeLessThanOrEqual(Math.abs(later[i]) * 0.01 + 1e-6);
  });
});

describe('level', () => {
  it('brings a voice that one spike made quiet up to the target, peaks held', () => {
    const x = take(0.05, { spike: 1 });
    normalize(x, 0.95); // the spike sets the peak: the voice ends up quiet
    expect(voiceLoudness(x, SR)).toBeLessThan(LEVEL.targetDb - 3);
    const gain = level(x, SR);
    expect(gain).toBeGreaterThan(3);
    expect(voiceLoudness(x, SR)).toBeGreaterThan(LEVEL.targetDb - 1.5);
    expect(peakOf(x)).toBeLessThanOrEqual(LEVEL.ceiling);
  });
  it('raises a very quiet one by no more than the cap, so its noise stays down', () => {
    const x = take(0.002, { noise: 0.0005 });
    const before = voiceLoudness(x, SR);
    expect(level(x, SR)).toBe(LEVEL.maxBoostDb);
    expect(voiceLoudness(x, SR)).toBeCloseTo(before + LEVEL.maxBoostDb, 1);
  });
  it('turns a loud one down by no more than the cut cap', () => {
    const x = take(0.95);
    expect(level(x, SR)).toBe(-LEVEL.maxCutDb);
  });
});
