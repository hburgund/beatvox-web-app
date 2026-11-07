// Recipes: a beat saved as JSON, so it can be stored, shared and recalled.
//
// The same format covers two uses:
// - a **style** (genre preset): patterns and roles, no slices, since it has
//   to work with anyone's voice;
// - a **saved beat**: everything, including which slice each voice plays,
//   tied to one recording and the slicer settings that cut it.
//
// Patterns are 16-character strings, one character per sixteenth note,
// written like drum-machine notation so they read at a glance:
//   "x...x...x...x..."   x = hit, X = accent, o = ghost note, . = rest
// "1" and "0" are accepted too, so v1.93-style "1000100010001000" works.
//
// Example:
// {
//   "format": "beatvox-recipe", "version": 1,
//   "name": "Boom Bap", "kind": "style",
//   "bpm": 90, "swing": 0.12, "space": 25,
//   "evolve": { "auto": false },
//   "voices": [
//     { "role": "kick",  "pattern": "X.....x...x.....", "velocity": 105 },
//     { "role": "snare", "pattern": "....X.......X..." },
//     { "role": "hat",   "pattern": "x.o.x.o.x.o.x.ox" }
//   ]
// }

export const RECIPE_FORMAT = 'beatvox-recipe';
export const RECIPE_VERSION = 1;
export const STEPS = 16;
export const MAX_VOICES = 8;

/** What a voice is for. Used later to pick fitting slices (kick = low and
 *  round, hat = short and hissy...); until then slices are dealt at random. */
export type Role = 'kick' | 'snare' | 'hat' | 'perc' | 'tonal' | 'any';
export const ROLES: Role[] = ['kick', 'snare', 'hat', 'perc', 'tonal', 'any'];

export interface RecipeVoice {
  pattern: string;
  /** default true */
  on?: boolean;
  role?: Role;
  /** slice index; only in saved beats (null or absent = deal one) */
  slice?: number | null;
  /** starting velocity 50–110 (it still drifts, as in v1.93) */
  velocity?: number;
  delaySend?: number;
  reverbSend?: number;
}

export interface Recipe {
  format: typeof RECIPE_FORMAT;
  version: number;
  name: string;
  kind: 'style' | 'saved';
  bpm?: number;
  /** 0..0.5: how late the off-beat sixteenths land */
  swing?: number;
  pitch?: number;
  /** auto-pan width 0..100 */
  panning?: number;
  /** Simple-mode Space knob 0..100 */
  space?: number;
  evolve?: { auto: boolean; every?: number };
  /** up to 8; missing voices are off */
  voices: RecipeVoice[];
  seed?: number;
  /** saved beats only: which recording and how it was sliced */
  source?: { assetId?: number | string; slicer?: { method: string; params?: Record<string, number> } };
}

export interface ParsedPattern {
  hits: boolean[];
  /** gain multiplier per step: accent 1.25, normal 1, ghost 0.55 */
  accent: number[];
}

const LEVEL: Record<string, number> = { X: 1.25, x: 1, '1': 1, o: 0.55 };

export function parsePattern(s: string): ParsedPattern {
  const chars = [...s.replace(/[\s|]/g, '')];
  if (chars.length !== STEPS) throw new Error(`pattern "${s}" has ${chars.length} steps, needs ${STEPS}`);
  const hits: boolean[] = [];
  const accent: number[] = [];
  for (const c of chars) {
    if (c === '.' || c === '0' || c === '-') {
      hits.push(false);
      accent.push(1);
    } else if (c in LEVEL) {
      hits.push(true);
      accent.push(LEVEL[c]);
    } else {
      throw new Error(`pattern "${s}": unknown step "${c}" (use x X o .)`);
    }
  }
  return { hits, accent };
}

export function formatPattern(hits: boolean[], accent?: number[]): string {
  return hits
    .map((h, i) => {
      if (!h) return '.';
      const a = accent?.[i] ?? 1;
      return a > 1.1 ? 'X' : a < 0.8 ? 'o' : 'x';
    })
    .join('');
}

/** Check a parsed JSON value and return it as a Recipe, or throw saying what's wrong. */
export function validateRecipe(value: unknown): Recipe {
  const r = value as Recipe;
  if (!r || typeof r !== 'object') throw new Error('recipe must be an object');
  if (r.format !== RECIPE_FORMAT) throw new Error(`not a BeatVox recipe (format should be "${RECIPE_FORMAT}")`);
  if (typeof r.version !== 'number' || r.version > RECIPE_VERSION) throw new Error(`unsupported recipe version ${r.version}`);
  if (typeof r.name !== 'string') throw new Error('recipe needs a name');
  if (!Array.isArray(r.voices) || r.voices.length > MAX_VOICES) throw new Error(`recipe needs 0–${MAX_VOICES} voices`);
  for (const v of r.voices) {
    parsePattern(v.pattern);
    if (v.role && !ROLES.includes(v.role)) throw new Error(`unknown role "${v.role}"`);
  }
  if (r.bpm !== undefined && !(r.bpm >= 20 && r.bpm <= 300)) throw new Error('bpm out of range');
  if (r.swing !== undefined && !(r.swing >= 0 && r.swing <= 0.5)) throw new Error('swing must be 0–0.5');
  return r;
}

export function parseRecipe(json: string): Recipe {
  return validateRecipe(JSON.parse(json));
}
