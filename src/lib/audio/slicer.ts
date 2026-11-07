// BeatVox slicers. Each turns a recording into a list of slices (start/end in seconds).
//   attacks   – spectral-flux onsets: punchy, percussive cuts at consonant attacks
//   syllables – dips in the smoothed speech-band envelope: one slice per spoken syllable
//   mixed     – syllable slices, snapped to nearby attacks and split at strong ones

import { analyze, smooth, type Features } from './analysis';

export type SliceMethod = 'attacks' | 'syllables' | 'mixed';
export const METHODS: SliceMethod[] = ['attacks', 'syllables', 'mixed'];

export interface SliceParams {
  /** ignore anything quieter than this many dB below the loudest moment */
  floorDb: number;
  minLenMs: number;
  maxLenMs: number;
  /** start each slice this much before the detected point */
  prerollMs: number;
  /** attacks: 0 = only the hardest attacks, 1 = every little bump */
  attackSensitivity: number;
  attackMinGapMs: number;
  /** syllables: envelope smoothing */
  syllableSmoothMs: number;
  /** syllables: how deep a dip between two peaks must be to split them */
  syllableDipDb: number;
  syllableMinGapMs: number;
  /** mixed: 0 = split syllables at any attack, 1 = only at very strong attacks */
  mixedSplitStrength: number;
}

export const DEFAULT_PARAMS: SliceParams = {
  floorDb: -40,
  minLenMs: 60,
  maxLenMs: 1500,
  prerollMs: 15,
  attackSensitivity: 0.5,
  attackMinGapMs: 80,
  syllableSmoothMs: 30,
  syllableDipDb: 4,
  syllableMinGapMs: 100,
  mixedSplitStrength: 0.6,
};

export interface Slice {
  start: number;
  end: number;
  /** loudest frame inside the slice, dB re loudest frame overall */
  peakDb: number;
}

export interface SliceResult {
  method: SliceMethod;
  slices: Slice[];
  /** detection curve for display, 0..1, one value per frame */
  curve: Float32Array;
  frameDur: number;
}

interface Onset { frame: number; start: number; strength: number }

const msToFrames = (ms: number, f: Features) => Math.max(1, Math.round(ms / 1000 / f.frameDur));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function detectAttacks(f: Features, p: SliceParams): Onset[] {
  const delta = lerp(0.6, 0.04, p.attackSensitivity);
  const meanR = msToFrames(100, f);
  const localMean = smooth(f.flux, meanR);
  const minGap = msToFrames(p.attackMinGapMs, f);
  const back = msToFrames(30, f);
  const out: Onset[] = [];
  let last = -Infinity;
  for (let i = 1; i < f.frames - 1; i++) {
    const v = f.flux[i];
    if (v < f.flux[i - 1] || v <= f.flux[i + 1]) continue;
    if (v - localMean[i] < delta) continue;
    let loud = -100;
    for (let k = i; k < Math.min(f.frames, i + 5); k++) loud = Math.max(loud, f.levelDb[k]);
    if (loud < p.floorDb) continue;
    if (i - last < minGap) {
      // keep the stronger of two onsets that are too close
      const prev = out[out.length - 1];
      if (prev && v - localMean[i] > prev.strength) out.pop();
      else continue;
    }
    // backtrack to the quietest frame just before the attack: a cleaner cut point
    let start = i;
    for (let k = i - 1; k >= Math.max(0, i - back); k--) if (f.levelDb[k] < f.levelDb[start]) start = k;
    out.push({ frame: i, start, strength: v - localMean[i] });
    last = i;
  }
  return out;
}

/** Frame where the level first falls below the floor after `from`, else `limit`. */
function decayEnd(f: Features, from: number, limit: number, floorDb: number) {
  for (let k = from; k < limit; k++) if (f.levelDb[k] < floorDb) return k;
  return limit;
}

function attackSlices(f: Features, p: SliceParams): [number, number][] {
  const on = detectAttacks(f, p);
  return on.map((o, j) => {
    const next = j + 1 < on.length ? on[j + 1].start : f.frames - 1;
    return [o.start, decayEnd(f, o.frame + msToFrames(p.minLenMs, f), next, p.floorDb)];
  });
}

function syllableEnvelope(f: Features, p: SliceParams) {
  return smooth(f.bandDb, Math.round(msToFrames(p.syllableSmoothMs, f) / 2));
}

function syllableBounds(f: Features, p: SliceParams, env: Float32Array): [number, number][] {
  const minGap = msToFrames(p.syllableMinGapMs, f);
  const argmin = (a: number, b: number) => {
    let m = a;
    for (let k = a; k <= b; k++) if (env[k] < env[m]) m = k;
    return m;
  };

  // candidate nuclei: local maxima above the floor
  const peaks: number[] = [];
  for (let i = 1; i < f.frames - 1; i++) {
    if (env[i] > p.floorDb && env[i] >= env[i - 1] && env[i] > env[i + 1]) {
      // merge with the previous nucleus if the dip between them is shallow or they're too close
      const k = peaks[peaks.length - 1];
      if (k !== undefined) {
        const valley = env[argmin(k, i)];
        if (Math.min(env[k], env[i]) - valley < p.syllableDipDb || i - k < minGap) {
          if (env[i] > env[k]) peaks[peaks.length - 1] = i;
          continue;
        }
      }
      peaks.push(i);
    }
  }

  return peaks.map((n, j) => {
    const left = j > 0 ? argmin(peaks[j - 1], n) : 0;
    const right = j + 1 < peaks.length ? argmin(n, peaks[j + 1]) : f.frames - 1;
    // tighten to the silence edges when the syllable is surrounded by quiet
    let s = n;
    while (s > left && env[s - 1] > p.floorDb) s--;
    let e = n;
    while (e < right && env[e + 1] > p.floorDb) e++;
    return [s, e] as [number, number];
  });
}

function mixedSlices(f: Features, p: SliceParams, env: Float32Array): [number, number][] {
  const syl = syllableBounds(f, p, env);
  const att = detectAttacks(f, p);
  const snap = msToFrames(30, f);
  const minLen = msToFrames(p.minLenMs, f);
  const splitAt = lerp(0.1, 1.5, p.mixedSplitStrength);
  const out: [number, number][] = [];
  for (const [s0, e] of syl) {
    let s = s0;
    const near = att.find((a) => Math.abs(a.start - s0) <= snap);
    if (near) s = near.start;
    const cuts = att
      .filter((a) => a.strength >= splitAt && a.start > s + minLen && a.start < e - minLen)
      .map((a) => a.start);
    let cur = s;
    for (const c of cuts) {
      if (c - cur >= minLen) { out.push([cur, c]); cur = c; }
    }
    out.push([cur, e]);
  }
  return out;
}

export function sliceSignal(signal: Float32Array, sampleRate: number, method: SliceMethod, params: SliceParams, features?: Features): SliceResult {
  const f = features ?? analyze(signal, sampleRate);
  let bounds: [number, number][];
  let curve: Float32Array;
  if (method === 'attacks') {
    bounds = attackSlices(f, params);
    curve = f.flux.map((v) => Math.min(1, v / 1.5));
  } else {
    const env = syllableEnvelope(f, params);
    bounds = method === 'syllables' ? syllableBounds(f, params, env) : mixedSlices(f, params, env);
    curve = env.map((v) => Math.max(0, 1 - v / params.floorDb));
  }

  const dur = signal.length / sampleRate;
  const slices: Slice[] = [];
  for (const [a, b] of bounds) {
    const start = Math.max(0, a * f.frameDur - params.prerollMs / 1000);
    const end = Math.min(dur, b * f.frameDur, start + params.maxLenMs / 1000);
    if ((end - start) * 1000 < params.minLenMs) continue;
    let peak = -100;
    for (let k = a; k <= b; k++) peak = Math.max(peak, f.levelDb[k] ?? -100);
    if (peak < params.floorDb) continue;
    slices.push({ start, end, peakDb: peak });
  }
  return { method, slices, curve, frameDur: f.frameDur };
}
