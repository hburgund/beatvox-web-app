// Instruments: a voice recording and how it was cut into slices.
//
// An instrument and a recipe work together:
// - the **instrument** is the sound: the recording, its clean-up, and the
//   exact slice boundaries with their drum-role scores;
// - the **recipe** is how it's played: patterns, tempo, effects
//   (see recipe.ts).
//
// Any instrument can play any recipe:
//   your instrument + a style          → what NEXT does today
//   your instrument + your saved beat  → a saved BeatVox
//   someone else's instrument + your beat → a reVox
// A recipe's slice numbers only apply to the instrument it was saved with;
// on any other instrument, voices pick slices by role instead.
//
// Slice times are stored, not just the slicer settings, so that improving
// the slicer later never changes what an old saved beat sounds like.
//
// In Roundware v3 the recording is an audio asset, and the instrument JSON
// is a text asset whose parent_asset_id is that audio asset.
//
// Example:
// {
//   "format": "beatvox-instrument", "version": 1,
//   "id": "6f1c…",
//   "source": { "assetId": 4821, "duration": 6.62, "sampleRate": 44100 },
//   "prepare": { "lowCut": 80, "normalize": 0.95 },
//   "slicer": { "method": "mixed", "params": { "floorDb": -40, … } },
//   "slices": [
//     { "start": 0.212, "end": 0.398, "peakDb": -3.1, "role": "kick",
//       "scores": { "kick": 0.81, "snare": 0.4, "hat": 0.12, "perc": 0.3, "tonal": 0.55 } }
//   ]
// }

import { bestRole, roleScores, sliceTraits, type RoleScores } from './audio/drumRoles';
import { DEFAULT_PREPARE } from './audio/prepare';
import { DEFAULT_PARAMS, sliceSignal, type Slice, type SliceMethod, type SliceParams } from './audio/slicer';
import type { Role } from './recipe';

export const INSTRUMENT_FORMAT = 'beatvox-instrument';
export const INSTRUMENT_VERSION = 1;

export interface InstrumentSlice extends Slice {
  /** the role this slice suits best */
  role: Exclude<Role, 'any'>;
  scores: RoleScores;
}

export interface Instrument {
  format: typeof INSTRUMENT_FORMAT;
  version: number;
  id: string;
  /** the recording this was cut from */
  source: {
    /** Roundware asset id, once uploaded */
    assetId?: number | string;
    duration: number;
    sampleRate: number;
  };
  /** clean-up applied before slicing (see audio/prepare.ts) */
  prepare: { lowCut: number; normalize: number };
  /** how the slices were found (for reference; the slice times are what count) */
  slicer: { method: SliceMethod; params: SliceParams };
  slices: InstrumentSlice[];
  /** optional: Roundware participant who recorded it */
  participant?: number | string;
  createdAt?: string;
}

/** The part of a recipe that points at an instrument. */
export interface InstrumentRef {
  id: string;
  assetId?: number | string;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;

export function createInstrument(opts: {
  slices: Slice[];
  scores: RoleScores[];
  bestRoles: Exclude<Role, 'any'>[];
  duration: number;
  sampleRate: number;
  method: SliceMethod;
  params: SliceParams;
  prepare: { lowCut: number; normalize: number };
  assetId?: number | string;
}): Instrument {
  return {
    format: INSTRUMENT_FORMAT,
    version: INSTRUMENT_VERSION,
    id: newId(),
    source: { assetId: opts.assetId, duration: round(opts.duration, 3), sampleRate: opts.sampleRate },
    prepare: opts.prepare,
    slicer: { method: opts.method, params: { ...opts.params } },
    slices: opts.slices.map((s, i) => ({
      start: round(s.start, 4),
      end: round(s.end, 4),
      peakDb: round(s.peakDb, 1),
      role: opts.bestRoles[i],
      scores: Object.fromEntries(Object.entries(opts.scores[i]).map(([k, v]) => [k, round(v, 3)])) as RoleScores,
    })),
    createdAt: new Date().toISOString(),
  };
}

/** Slice a prepared (mono, cleaned-up) recording and score its slices. */
export function cutInstrument(
  mono: Float32Array,
  sampleRate: number,
  opts: { method?: SliceMethod; params?: SliceParams; prepare?: typeof DEFAULT_PREPARE; assetId?: number | string } = {},
): Instrument {
  const method = opts.method ?? 'mixed';
  const params = opts.params ?? DEFAULT_PARAMS;
  const { slices } = sliceSignal(mono, sampleRate, method, params);
  const scores = roleScores(slices.map((s) => sliceTraits(mono, sampleRate, s)));
  return createInstrument({
    slices,
    scores,
    bestRoles: scores.map(bestRole),
    duration: mono.length / sampleRate,
    sampleRate,
    method,
    params,
    prepare: opts.prepare ?? DEFAULT_PREPARE,
    assetId: opts.assetId,
  });
}

export function instrumentRef(inst: Instrument): InstrumentRef {
  return inst.source.assetId !== undefined ? { id: inst.id, assetId: inst.source.assetId } : { id: inst.id };
}

const ROLE_KEYS = ['kick', 'snare', 'hat', 'perc', 'tonal'] as const;

/** Check a parsed JSON value and return it as an Instrument, or throw saying what's wrong. */
export function validateInstrument(value: unknown): Instrument {
  const r = value as Instrument;
  if (!r || typeof r !== 'object') throw new Error('instrument must be an object');
  if (r.format !== INSTRUMENT_FORMAT) throw new Error(`not a BeatVox instrument (format should be "${INSTRUMENT_FORMAT}")`);
  if (typeof r.version !== 'number' || r.version > INSTRUMENT_VERSION) throw new Error(`unsupported instrument version ${r.version}`);
  if (typeof r.id !== 'string' || !r.id) throw new Error('instrument needs an id');
  if (!r.source || !(r.source.duration > 0)) throw new Error('instrument needs source.duration');
  if (!Array.isArray(r.slices) || !r.slices.length) throw new Error('instrument needs at least one slice');
  for (const s of r.slices) {
    if (!(s.start >= 0 && s.end > s.start && s.end <= r.source.duration + 0.01)) {
      throw new Error(`slice ${s.start}–${s.end} is outside the recording`);
    }
    if (!s.scores || ROLE_KEYS.some((k) => typeof s.scores[k] !== 'number')) throw new Error('every slice needs role scores');
  }
  return r;
}

export function parseInstrument(json: string): Instrument {
  return validateInstrument(JSON.parse(json));
}
