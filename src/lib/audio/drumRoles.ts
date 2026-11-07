// Guess which drum each slice is good for.
//
// Each slice gets a few sound measurements ("traits"). Scores are relative
// within one recording, because voices differ so much: the "kick" is simply
// this person's deepest, roundest slice, the "hat" their brightest, hissiest.
//
//   kick   low, round, not noisy           ("b", "d", "oo", "bum")
//   snare  noisy mid-highs, sharp attack    ("t", "k", "ch", "p")
//   hat    bright, hissy, short             ("s", "sh", "ts")
//   perc   short and sharp, in between
//   tonal  clearly pitched vowels

import { fft } from './analysis';
import { slicePitch } from './pitch';
import type { Slice } from './slicer';
import type { Role } from '../recipe';
import type { Rng } from './rng';

export interface SliceTraits {
  /** seconds */
  dur: number;
  /** spectral centroid, Hz */
  centroid: number;
  /** spectral flatness 0..1 (1 = white noise) */
  flatness: number;
  /** share of energy below 250 Hz */
  low: number;
  /** share of energy above 5 kHz */
  high: number;
  /** ms from slice start to its loudest moment */
  attackMs: number;
  /** share of voiced (pitched) frames 0..1 */
  voiced: number;
  /** peak level, dB */
  peakDb: number;
}

export const DRUM_ROLES: Exclude<Role, 'any'>[] = ['kick', 'snare', 'hat', 'perc', 'tonal'];
export type RoleScores = Record<Exclude<Role, 'any'>, number>;

const N = 1024;
const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));

export function sliceTraits(mono: Float32Array, sr: number, s: Slice): SliceTraits {
  const a = Math.floor(s.start * sr);
  const b = Math.min(mono.length, Math.floor(s.end * sr));
  // the character is in the first part of a hit, so look at up to 250 ms
  const end = Math.min(b, a + Math.floor(0.25 * sr));

  const half = N / 2;
  const power = new Float64Array(half);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let off = a; off < Math.max(a + 1, end - N / 2); off += N / 2) {
    for (let i = 0; i < N; i++) {
      re[i] = (mono[off + i] ?? 0) * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < half; k++) power[k] += re[k] * re[k] + im[k] * im[k];
  }
  const hz = (k: number) => (k * sr) / N;
  let total = 0, weighted = 0, low = 0, high = 0, logSum = 0, count = 0, flatSum = 0;
  for (let k = 1; k < half; k++) {
    const p = power[k];
    const f = hz(k);
    total += p;
    weighted += p * f;
    if (f < 250) low += p;
    if (f > 5000) high += p;
    if (f >= 100 && f <= 10000) {
      logSum += Math.log(p + 1e-12);
      flatSum += p;
      count++;
    }
  }
  const flatness = count && flatSum > 0 ? Math.exp(logSum / count) / (flatSum / count) : 0;

  // 5 ms envelope for the attack time and peak
  const w = Math.max(1, Math.floor(0.005 * sr));
  let peak = 0, peakAt = 0;
  for (let i = a; i + w <= Math.min(b, a + Math.floor(0.15 * sr)); i += w) {
    let acc = 0;
    for (let j = i; j < i + w; j++) acc += mono[j] * mono[j];
    const rms = Math.sqrt(acc / w);
    if (rms > peak) {
      peak = rms;
      peakAt = i - a;
    }
  }

  return {
    dur: s.end - s.start,
    centroid: total > 0 ? weighted / total : 0,
    flatness,
    low: total > 0 ? low / total : 0,
    high: total > 0 ? high / total : 0,
    attackMs: (peakAt / sr) * 1000,
    voiced: slicePitch(mono, sr, s.start, s.end).voiced,
    peakDb: 20 * Math.log10(peak + 1e-9),
  };
}

/** 0..1 rank of each value among the others (ties share a rank). */
function ranks(values: number[]): number[] {
  if (values.length < 2) return values.map(() => 0.5);
  const sorted = [...values].sort((x, y) => x - y);
  return values.map((v) => {
    const first = sorted.indexOf(v);
    const last = sorted.lastIndexOf(v);
    return (first + last) / 2 / (values.length - 1);
  });
}

/** How well each slice suits each role, relative to the other slices. */
export function roleScores(traits: SliceTraits[]): RoleScores[] {
  const c = ranks(traits.map((t) => t.centroid));
  const flat = ranks(traits.map((t) => t.flatness));
  const low = ranks(traits.map((t) => t.low));
  const high = ranks(traits.map((t) => t.high));
  const dur = ranks(traits.map((t) => t.dur));
  const sharp = ranks(traits.map((t) => -t.attackMs));
  const loud = ranks(traits.map((t) => t.peakDb));
  const mid = (r: number, at: number) => 1 - Math.min(1, Math.abs(r - at) * 2);
  return traits.map((t, i) => ({
    kick: 0.4 * (1 - c[i]) + 0.3 * low[i] + 0.15 * (1 - flat[i]) + 0.15 * loud[i],
    snare: 0.35 * flat[i] + 0.25 * mid(c[i], 0.7) + 0.25 * sharp[i] + 0.15 * loud[i],
    hat: 0.35 * c[i] + 0.3 * high[i] + 0.2 * flat[i] + 0.15 * (1 - dur[i]),
    perc: 0.35 * sharp[i] + 0.3 * (1 - dur[i]) + 0.35 * mid(c[i], 0.5),
    tonal: 0.55 * t.voiced + 0.25 * dur[i] + 0.2 * (1 - flat[i]),
  }));
}

/** The role each slice suits best. */
export function bestRole(s: RoleScores): Exclude<Role, 'any'> {
  return DRUM_ROLES.reduce((best, r) => (s[r] > s[best] ? r : best), DRUM_ROLES[0]);
}

/**
 * Give each wanted role its own slice, best matches first. Roles of 'any'
 * (or null) are skipped and left as -1 for the caller to deal at random.
 * A little jitter keeps the same style from always picking the same slices.
 */
export function matchSlices(scores: RoleScores[], wanted: (Role | null)[], taken: Set<number>, rng?: Rng, jitter = 0.06): number[] {
  const out = wanted.map(() => -1);
  const pairs: { v: number; s: number; score: number }[] = [];
  wanted.forEach((role, v) => {
    if (!role || role === 'any') return;
    scores.forEach((sc, s) => {
      if (!taken.has(s)) pairs.push({ v, s, score: sc[role] + (rng ? rng.range(0, jitter) : 0) });
    });
  });
  pairs.sort((x, y) => y.score - x.score);
  const used = new Set(taken);
  for (const p of pairs) {
    if (out[p.v] >= 0 || used.has(p.s)) continue;
    out[p.v] = p.s;
    used.add(p.s);
  }
  return out;
}
