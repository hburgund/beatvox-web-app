// The BeatVox engine, ported from v1.93 (hb.rhyvoice2, hb.trigger,
// hb.voxnode, hb.quadautopan2 and the main patch's kickoff / driver logic).
//
// - 8 voices × 16 sixteenth-note steps, one slice per voice (urn, no repeats)
// - each hit plays its whole slice, with a fade in and a fade out at the
//   edges; a new hit on the same voice quickly fades out the one before, so a
//   lone hit rings to the end and a busy row stays tight. (v1.93 gated every
//   hit to 100 / 300 / 100 ms; that cut long slices short.)
// - loudness: each voice has a steady mix level, and a humanize walk on top
//   wanders each hit between 0.45× and 1× (v1.93's brownian velocity 50–110)
// - humanize also keeps a fast row from sounding like a machine gun: each hit
//   starts a few ms into its slice, is detuned a few cents, wobbles in
//   loudness, alternates strong-weak on running 16ths, and lands up to 4 ms
//   late (never on a beat); each row has its own slight tuning (v1.93 tuned
//   each voice at random). All of it scales with `humanize`: 0 = machine.
// - pan: each row is FIXED at one place, or ROAMs inside its own range: a
//   random ramp every 2–10 s (linear, sine or wobbly), like v1.93's auto-pan.
//   By default rows spread like a drum kit in a mix (see defaultPan).
// - New Beat, Evolve and styles land on the next downbeat; edits to one row
//   (a box, resting a row, a new slice, its level) apply at once
// - kickoff: 1 voice, +1 at 5 s, +1 at 10 s, auto-evolve from 12 s every 3 s
//
// All randomness comes from a seeded Rng, and the audio clock drives
// everything (kickoff, evolve, pan), so the same engine can later run in an
// OfflineAudioContext to render the shared MP3.

import { Rng } from './rng';
import type { FxChain, FxParams } from './fx';
import { VoiceBank, type Cmd } from './voiceBank';
import type { Slice } from './slicer';
import { matchSlices, type RoleScores } from './drumRoles';
import { instrumentRef, refersTo, type Instrument } from '../instrument';
import { formatPattern, parsePattern, RECIPE_FORMAT, RECIPE_VERSION, type Recipe, type Role } from '../recipe';

export const VOICES = 8;
export const STEPS = 16;
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

const bits = (s: string) => [...s].map((c) => c === '1');
export const PATTERNS = {
  allOn: bits('1111111111111111'),
  eighths: bits('1010101010101010'),
  quarters: bits('1000100010001000'),
  groove: bits('1001011000010111'),
  allOff: bits('0000000000000000'),
  offbeats: bits('0010001000100010'),
  halves: bits('1000000010000000'),
};

/** The quick patterns a row can be set to: every 16th, 8th, quarter or half
 * note, the off-beat 8ths, 2–10 random hits, or nothing. */
export const ROW_FILLS = ['16', '8', '4', '2', 'off', 'random', 'none'] as const;
export type RowFill = (typeof ROW_FILLS)[number];
const FILL_PATTERNS: Record<Exclude<RowFill, 'random'>, boolean[]> = {
  '16': PATTERNS.allOn,
  '8': PATTERNS.eighths,
  '4': PATTERNS.quarters,
  '2': PATTERNS.halves,
  off: PATTERNS.offbeats,
  none: PATTERNS.allOff,
};

/** Which quick pattern a row's hits match, if any ('random' never matches). */
export function fillOf(pattern: boolean[]): RowFill | null {
  for (const [k, p] of Object.entries(FILL_PATTERNS)) if (p.every((b, i) => b === pattern[i])) return k as RowFill;
  return null;
}
const PRESET_LIST = [PATTERNS.allOn, PATTERNS.eighths, PATTERNS.quarters, PATTERNS.groove, PATTERNS.allOff];

export type PanShape = 'linear' | 'sine' | 'wobble';
export type PanMode = 'fixed' | 'roam';

/** A row's place in the stereo field, -1 (left) to 1 (right). */
export interface PanSetting {
  mode: PanMode;
  /** FIXED: where it stays */
  at: number;
  /** ROAM: the range it wanders in */
  lo: number;
  hi: number;
}

/** The role a recipe row's default pan goes by. */
const panRole = (rv: Recipe['voices'][number]): Role => (rv.role && rv.role !== 'any' ? rv.role : (rv.sliceRole ?? 'any'));

/**
 * A recipe row's pan: its own, else an older beat's one width for every row,
 * else by role. `nth` counts the rows of the same role before it.
 */
function recipePan(rv: Recipe['voices'][number], nth: number, panning?: number): PanSetting {
  const base = defaultPan(panRole(rv), nth);
  if (typeof rv.pan === 'number') return { ...base, mode: 'fixed', at: rv.pan };
  if (Array.isArray(rv.pan)) return { ...base, mode: 'roam', lo: Math.min(...rv.pan), hi: Math.max(...rv.pan) };
  if (panning !== undefined) return { mode: 'roam', at: 0, lo: -panning / 100, hi: panning / 100 };
  return base;
}

/**
 * Where a row sits until someone moves it, spread like a drum kit in a mix:
 * kick fixed in the middle, snare fixed just left of it, hats roaming a little
 * right of centre, percussion roaming wide, tonal sounds the middle 40%. A
 * second row of the same role (`nth` 1, 3…) goes to the other side, so two
 * hat rows spread out instead of piling up. Every row has both settings, so
 * the FIXED / ROAM toggle has somewhere sensible to go.
 */
export function defaultPan(role: Role, nth = 0): PanSetting {
  const side = nth % 2 === 0 ? 1 : -1;
  const flip = (lo: number, hi: number) => (side === 1 ? { lo, hi } : { lo: -hi, hi: -lo });
  switch (role) {
    case 'kick':
      return { mode: 'fixed', at: 0, lo: -0.3, hi: 0.3 };
    case 'snare':
      return { mode: 'fixed', at: -0.1 * side, ...flip(-0.3, 0.1) };
    case 'hat':
      return { mode: 'roam', at: 0.25 * side, ...flip(0.1, 0.4) };
    case 'perc':
      return { mode: 'roam', at: 0.15 * side, ...flip(-0.4, 0.7) };
    case 'tonal':
      return { mode: 'roam', at: 0, lo: -0.4, hi: 0.4 };
    default:
      return { mode: 'roam', at: 0, lo: -0.6, hi: 0.6 };
  }
}

export interface Voice {
  on: boolean;
  slice: number;
  pattern: boolean[];
  /** gain per step (accent 1.25, ghost 0.55); 1 unless a recipe set it */
  accent: number[];
  role: Role;
  /** mix level 0..1, 1 = the recording's natural level; steady */
  level: number;
  /** where the row sits: FIXED at one place or ROAMing a range (both kept, so the toggle can flip back) */
  pan: PanSetting;
  /** humanize multiplier, wanders between HUMAN_FLOOR and 1 on each hit */
  human: number;
  /** this row's own slight tuning, cents at full humanize */
  cents: number;
  /** the step this row last played (to alternate hands on running 16ths) */
  lastAbs: number;
  hand: number;
  delaySend: number;
  reverbSend: number;
  /** the quick pattern this row was last set to, until its hits change */
  fill?: RowFill;
}

/** The fades at each end of a hit, seconds. */
export interface Envelope {
  attack: number;
  release: number;
}

export interface EngineSettings {
  bpm: number;
  /** playback rate for every hit (v1.93 PITCH) */
  pitch: number;
  autoEvolve: boolean;
  /** seconds between automatic Evolve changes */
  evolveEvery: number;
  /** 0..0.5 of a step: how late the off-beat sixteenths land */
  swing: number;
  envelope: Envelope;
  /** 0..1: how much each hit varies (loudness, start, pitch, timing); 0 = machine-steady */
  humanize: number;
}

export const DEFAULT_SETTINGS: EngineSettings = {
  bpm: 89,
  pitch: 1,
  autoEvolve: false,
  evolveEvery: 3,
  swing: 0,
  // v1.93 used 100 ms in; the reference MP3's hits rise in ~50 ms
  envelope: { attack: 0.05, release: 0.1 },
  humanize: 0.6,
};

// Humanize at full strength reproduces v1.93's velocity walk: 50–110 out of
// 127 (×1.15) is 0.45–1.0 of full level, in steps of up to ±8/127×1.15.
const HUMAN_FLOOR = 0.45;
const HUMAN_STEP = 0.072;
// the rest of humanize, at full strength
/** each hit starts up to this far into its slice (seconds) */
const HUMAN_START = 0.006;
/** each hit detuned by up to ± this (cents) */
const HUMAN_CENTS = 15;
/** each row tuned by up to ± this (cents) */
const ROW_CENTS = 20;
/** quick loudness wobble per hit, ± */
const HUMAN_WOBBLE = 0.08;
/** the weak hand of running 16ths, this much quieter */
const HUMAN_HAND = 0.14;
/** each hit off the beat lands up to this late (seconds) */
const HUMAN_LATE = 0.004;

/** One step as heard: which voices fired. The UI reads these to flash the grid. */
export interface StepEvent {
  time: number;
  step: number;
  hits: number[];
}

export type Action =
  | { kind: 'newBeat' }
  | { kind: 'kickoff' }
  | { kind: 'kickoffStage'; stage: number }
  | { kind: 'evolve'; auto: boolean }
  | { kind: 'reslice' }
  | { kind: 'toggleStep'; voice: number; step: number }
  | { kind: 'toggleVoice'; voice: number }
  | { kind: 'setSlice'; voice: number; slice: number }
  | { kind: 'setLevel'; voice: number; level: number }
  | { kind: 'setPan'; voice: number; pan: Partial<PanSetting> }
  | { kind: 'fillRow'; voice: number; fill: RowFill }
  | { kind: 'settings'; settings: Partial<EngineSettings> }
  | { kind: 'recipe'; recipe: Recipe }
  | { kind: 'restore'; state: BeatState };

/** The beat itself, for undo: every row, and the bits of the beat that aren't on a knob. */
export interface BeatState {
  voices: Voice[];
  swing: number;
  /** rows given a slice by hand */
  pinned: number[];
  /** rows given a quick pattern by hand */
  held: number[];
}

const ones = () => Array<number>(STEPS).fill(1);

/** Sharper fades for drum roles; 'any' keeps the v1.93 attack. */
export const ROLE_ENVELOPE: Partial<Record<Role, Envelope>> = {
  kick: { attack: 0.008, release: 0.08 },
  snare: { attack: 0.004, release: 0.08 },
  hat: { attack: 0.002, release: 0.04 },
  perc: { attack: 0.004, release: 0.06 },
  tonal: { attack: 0.02, release: 0.12 },
};

interface PanState {
  /** when the next roam ramp starts (Infinity: FIXED, nothing to do) */
  nextAt: number;
  /** where the last ramp ends */
  value: number;
  /** the ramp sent last, to tell where the row is mid-ramp */
  ramp: { t: number; dur: number; curve: Float32Array } | null;
}

/**
 * A stretch of the performance, taped as the commands the engine sent to
 * the audio graph, so it can be rendered again exactly (render.ts).
 */
export interface Tape {
  /** audio time of the downbeat it starts on */
  start: number;
  /** audio time right after the last loop */
  end: number;
  loops: number;
  /** tempo when it started (sets the gap before the remix) */
  bpm: number;
  /** the state at `start`: effects, tempo, sends, each row's pan */
  head: Cmd[];
  /** everything sent from `start` to `end`, in order */
  cmds: Cmd[];
  /** the beat as it was when capture started */
  recipe: Recipe;
}

interface Capture {
  loops: number;
  stepsLeft: number;
  tape: Tape | null;
  resolve: (t: Tape) => void;
  reject: (e: Error) => void;
}

export class BeatEngine {
  voices: Voice[] = [];
  settings: EngineSettings = structuredClone(DEFAULT_SETTINGS);
  playing = false;
  /** bumps whenever voices or settings change, so the UI can redraw */
  version = 0;
  /** user actions with the step they took effect on (for exact re-rendering) */
  readonly log: { step: number; action: Action }[] = [];
  onChange: () => void = () => {};
  /** called just before an automatic evolve changes the beat (for undo) */
  onAutoChange: () => void = () => {};

  private rng: Rng;
  /** humanize's own random stream, so beats, evolves and slice choices come
   *  out the same for a seed whatever humanize does */
  private hr: Rng;
  /** pan ramps have their own dice, so moving a pan never changes what the beat does next */
  private pr: Rng;
  private buffer: AudioBuffer | null = null;
  private slices: Slice[] = [];
  /** drum-role scores per slice */
  private scores: RoleScores[] | null = null;
  private instrument: Instrument | null = null;
  private bank: VoiceBank;
  private pan: PanState[] = [];
  private cap: Capture | null = null;
  private queue: Action[] = [];
  /** rows given a slice by hand: evolve leaves their slice alone and doesn't rest them */
  private pinned = new Set<number>();
  /** rows given a quick pattern by hand: evolve leaves their hits alone */
  private held = new Set<number>();
  private events: StepEvent[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private nextTime = 0;
  private step = 0;
  private absStep = 0;
  private kickoffStart: number | null = null;
  private kickoffStage = 0;
  private nextEvolveAt = Infinity;

  constructor(
    private ctx: BaseAudioContext,
    private fx: FxChain,
    seed?: number,
  ) {
    this.rng = new Rng(seed);
    this.hr = new Rng((this.rng.seed ^ 0x9e3779b9) >>> 0);
    this.pr = new Rng((this.rng.seed ^ 0x85ebca6b) >>> 0);
    this.bank = new VoiceBank(ctx, fx);
    for (let v = 0; v < VOICES; v++) this.pan.push({ nextAt: 0, value: 0, ramp: null });
    this.applySettings({});
    this.voices = Array.from({ length: VOICES }, () => this.blankVoice());
  }

  get seed() {
    return this.rng.seed;
  }

  get sliceCount() {
    return this.slices.length;
  }

  get instrumentId() {
    return this.instrument?.id ?? null;
  }

  /**
   * Load an instrument: the voice recording (already prepared) and its
   * slices. With no recipe, starts a fresh beat with the v1.93 kickoff;
   * with one, plays that recipe instead.
   */
  load(buffer: AudioBuffer, instrument: Instrument, recipe?: Recipe) {
    this.cancelCapture();
    this.buffer = buffer;
    this.bank.setBuffer(buffer);
    this.useInstrument(instrument);
    this.queue = [];
    this.run(recipe ? { kind: 'recipe', recipe } : { kind: 'kickoff' });
  }

  private useInstrument(inst: Instrument) {
    this.instrument = inst;
    this.slices = inst.slices;
    this.scores = inst.slices.map((s) => s.scores);
  }

  /** Swap in a re-cut instrument for the same recording and keep the beat. */
  setInstrument(instrument: Instrument) {
    this.useInstrument(instrument);
    const slices = this.slices;
    const used = new Set<number>();
    for (const v of this.voices) {
      if (v.slice >= slices.length || used.has(v.slice)) v.slice = this.freeSlice(used);
      used.add(v.slice);
    }
    this.changed();
  }

  // ── user actions (applied on the next downbeat while playing) ──────────

  newBeat() {
    this.request({ kind: 'newBeat' });
  }
  evolve() {
    this.request({ kind: 'evolve', auto: false });
  }
  kickoff() {
    this.request({ kind: 'kickoff' });
  }
  /** New slices on every playing row: none in use now, no two alike, any role. */
  reslice() {
    this.request({ kind: 'reslice' });
  }
  toggleStep(voice: number, step: number) {
    this.request({ kind: 'toggleStep', voice, step });
  }
  toggleVoice(voice: number) {
    this.request({ kind: 'toggleVoice', voice });
  }
  /** Set a row's mix level, 0..1 (1 = the recording's natural level). */
  setLevel(voice: number, level: number) {
    this.request({ kind: 'setLevel', voice, level });
  }
  /** Set where a row sits: FIXED at `at`, or ROAMing `lo`..`hi` (-1 left to 1 right). */
  setPan(voice: number, pan: Partial<PanSetting>) {
    this.request({ kind: 'setPan', voice, pan });
  }
  /** Where a row is in the stereo field at time `t`, -1..1 (for the PAN view). */
  panPosition(voice: number, t: number) {
    return this.panNow(voice, t);
  }
  /** Set a row to a quick pattern (see ROW_FILLS). */
  fillRow(voice: number, fill: RowFill) {
    this.request({ kind: 'fillRow', voice, fill });
  }
  /** Give a row a different slice (a row already playing it takes this row's). */
  setSlice(voice: number, slice: number) {
    this.request({ kind: 'setSlice', voice, slice });
  }

  /** A copy of the beat as it is now (see restore). */
  snapshot(): BeatState {
    return {
      voices: structuredClone(this.voices),
      swing: this.settings.swing,
      pinned: [...this.pinned],
      held: [...this.held],
    };
  }

  /**
   * Put back a beat from snapshot(), at once. Drops anything waiting for the
   * downbeat, ends the kickoff and turns keep evolving off, so the beat you
   * went back to stays put.
   */
  restore(state: BeatState) {
    this.queue = [];
    this.run({ kind: 'restore', state });
  }

  /** Load a style or saved beat (on the next downbeat while playing). */
  applyRecipe(recipe: Recipe) {
    this.request({ kind: 'recipe', recipe });
  }

  /** The current beat as a recipe. */
  toRecipe(name: string, extra: Partial<Recipe> = {}): Recipe {
    const st = this.settings;
    return {
      format: RECIPE_FORMAT,
      version: RECIPE_VERSION,
      name,
      kind: 'beat',
      ...(this.instrument ? { instrument: instrumentRef(this.instrument) } : {}),
      bpm: st.bpm,
      swing: st.swing,
      pitch: st.pitch,
      humanize: +st.humanize.toFixed(2),
      evolve: { auto: st.autoEvolve, every: st.evolveEvery },
      seed: this.rng.seed,
      ...extra,
      voices: this.voices.map((v) => ({
        on: v.on,
        pattern: formatPattern(v.pattern, v.accent),
        role: v.role,
        slice: v.slice,
        sliceRole: this.instrument?.slices[v.slice]?.role,
        level: +v.level.toFixed(2),
        pan: v.pan.mode === 'fixed' ? +v.pan.at.toFixed(2) : ([+v.pan.lo.toFixed(2), +v.pan.hi.toFixed(2)] as [number, number]),
        delaySend: +v.delaySend.toFixed(2),
        reverbSend: +v.reverbSend.toFixed(2),
      })),
    };
  }

  /** Tempo, pitch, panning etc. take effect right away, like v1.93's sliders. */
  set(settings: Partial<EngineSettings>) {
    this.run({ kind: 'settings', settings });
  }

  /** Effects settings, through the engine so a capture tapes them too. */
  setFx(params: FxParams) {
    this.emit({ k: 'fx', t: this.ctx.currentTime, params });
  }

  // ── capture ───────────────────────────────────────────────────────────

  /**
   * Tape the next `loops` bars, starting on the next downbeat. Resolves
   * when the last one has been scheduled; rejects if playback stops first.
   */
  capture(loops: number): Promise<Tape> {
    this.cancelCapture();
    return new Promise((resolve, reject) => {
      this.cap = { loops, stepsLeft: loops * STEPS, tape: null, resolve, reject };
    });
  }

  cancelCapture(reason = 'capture cancelled') {
    const c = this.cap;
    this.cap = null;
    c?.reject(new Error(reason));
  }

  /** 0..1 how far a running capture has got by audio time `now`, or null */
  captureProgress(now: number): { waiting: boolean; done: number } | null {
    const c = this.cap;
    if (!c) return null;
    if (!c.tape || now < c.tape.start) return { waiting: true, done: 0 };
    const total = c.loops * STEPS;
    const stepDur = 60 / this.settings.bpm / 4;
    const scheduled = total - c.stepsLeft;
    // steps scheduled but not yet heard
    const ahead = Math.max(0, (this.nextTime - now) / stepDur);
    return { waiting: false, done: Math.min(1, Math.max(0, (scheduled - ahead) / total)) };
  }

  get capturing() {
    return this.cap !== null;
  }

  private emit(c: Cmd) {
    this.bank.apply(c);
    if (this.cap?.tape) this.cap.tape.cmds.push(c);
  }

  private request(a: Action) {
    // edits to one row (tap a box, rest a row, swap a slice) apply at once, so
    // the grid answers the tap; the sound follows from the next unscheduled
    // step (at most LOOKAHEAD away). Whole-beat changes wait for the downbeat.
    const now = !this.playing || a.kind === 'toggleStep' || a.kind === 'toggleVoice' || a.kind === 'setSlice' || a.kind === 'setLevel' || a.kind === 'setPan' || a.kind === 'fillRow';
    if (now) this.run(a);
    else this.queue.push(a);
  }

  private run(a: Action) {
    this.log.push({ step: this.absStep, action: a });
    switch (a.kind) {
      case 'kickoff':
        this.doNewBeat(true);
        break;
      case 'newBeat':
        this.doNewBeat(false);
        break;
      case 'kickoffStage':
        this.doKickoffStage(a.stage);
        break;
      case 'evolve':
        if (a.auto) this.onAutoChange();
        this.doEvolve();
        break;
      case 'reslice':
        this.doReslice();
        break;
      case 'toggleStep': {
        const v = this.voices[a.voice];
        v.pattern[a.step] = !v.pattern[a.step];
        v.accent[a.step] = 1;
        v.fill = undefined;
        break;
      }
      case 'toggleVoice':
        this.voices[a.voice].on = !this.voices[a.voice].on;
        break;
      case 'setLevel': {
        const v = this.voices[a.voice];
        if (v) v.level = Math.min(1, Math.max(0, a.level));
        break;
      }
      case 'setPan': {
        const v = this.voices[a.voice];
        if (!v) break;
        const p = { ...v.pan, ...a.pan };
        const clamp = (x: number) => Math.min(1, Math.max(-1, x));
        p.at = clamp(p.at);
        [p.lo, p.hi] = [clamp(Math.min(p.lo, p.hi)), clamp(Math.max(p.lo, p.hi))];
        v.pan = p;
        this.repan(a.voice);
        break;
      }
      case 'fillRow': {
        const v = this.voices[a.voice];
        if (!v) break;
        if (a.fill === 'random') {
          const hits = Array<boolean>(STEPS).fill(false);
          const n = 2 + this.rng.int(9);
          this.rng.shuffle([...Array(STEPS).keys()]).slice(0, n).forEach((i) => (hits[i] = true));
          this.setPattern(v, hits);
        } else {
          this.setPattern(v, [...FILL_PATTERNS[a.fill]]);
        }
        if (a.fill !== 'none') v.on = true;
        v.fill = a.fill;
        this.held.add(a.voice);
        break;
      }
      case 'setSlice': {
        const v = this.voices[a.voice];
        if (!v || a.slice < 0 || a.slice >= this.slices.length) break;
        const other = this.voices.find((o, j) => j !== a.voice && o.slice === a.slice);
        if (other) other.slice = v.slice;
        v.slice = a.slice;
        v.on = true;
        this.pinned.add(a.voice);
        break;
      }
      case 'settings':
        this.applySettings(a.settings);
        break;
      case 'recipe':
        this.doRecipe(a.recipe);
        break;
      case 'restore': {
        const st = structuredClone(a.state);
        this.voices = st.voices.map((v, i) => ({ ...v, lastAbs: this.voices[i]?.lastAbs ?? -2, hand: this.voices[i]?.hand ?? 0 }));
        this.pinned = new Set(st.pinned);
        this.held = new Set(st.held);
        this.kickoffStart = null;
        this.kickoffStage = 3;
        this.applySends();
        this.applySettings({ swing: st.swing, autoEvolve: false });
        break;
      }
    }
    // a new beat brings new pans (undo brings the old ones back)
    if (a.kind === 'kickoff' || a.kind === 'newBeat' || a.kind === 'recipe' || a.kind === 'restore') this.voices.forEach((_, i) => this.repan(i));
    this.changed();
  }

  private changed() {
    this.version++;
    this.onChange();
  }

  // ── beat generation ───────────────────────────────────────────────────

  /** a starting point for the humanize walk */
  private randomHuman() {
    return this.rng.range(1 - (1 - HUMAN_FLOOR) * this.settings.humanize, 1);
  }

  private blankVoice(): Voice {
    return { on: false, slice: 0, pattern: [...PATTERNS.allOff], accent: ones(), role: 'any', level: 1, pan: defaultPan('any'), human: 1, cents: 0, lastAbs: -2, hand: 0, delaySend: 0, reverbSend: 0 };
  }

  /** replace a voice's pattern (accents back to normal) */
  private setPattern(v: Voice, hits: boolean[]) {
    v.fill = undefined;
    v.pattern = hits;
    v.accent = ones();
  }

  /** v1.93 random pattern: every step a coin flip. */
  private randomPattern() {
    return Array.from({ length: STEPS }, () => this.rng.chance(0.5));
  }

  private presetPattern() {
    // all-off would just mute the voice, so it's rarer than the others
    return [...PRESET_LIST[this.rng.weighted([1, 2, 2, 2, 0.5])]];
  }

  private freeSlice(used: Set<number>) {
    const free = this.slices.map((_, i) => i).filter((i) => !used.has(i));
    if (free.length) return this.rng.pick(free);
    return this.slices.length ? this.rng.int(this.slices.length) : 0;
  }

  /** a free slice for a role: one of the 3 best fits, or any free one */
  private sliceFor(role: Role, used: Set<number>) {
    if (!this.scores || role === 'any') return this.freeSlice(used);
    const r = role;
    const ranked = this.scores
      .map((sc, i) => ({ i, score: sc[r] }))
      .filter((x) => !used.has(x.i))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return ranked.length ? this.rng.pick(ranked).i : this.freeSlice(used);
  }

  /**
   * RE-SLICE: each playing row (except ones given a slice by hand) gets a
   * slice no row has now, picked at random whatever its role. When the voice
   * runs short, it takes slices from resting rows next; a row with nothing
   * left to take keeps its own.
   */
  private doReslice() {
    const rows = this.voices.map((v, i) => (v.on && !this.pinned.has(i) ? i : -1)).filter((i) => i >= 0);
    if (!rows.length) return;
    const inUse = new Set(this.voices.map((v) => v.slice));
    const playing = new Set(this.voices.filter((v) => v.on).map((v) => v.slice));
    const fresh = this.rng.shuffle(this.slices.map((_, i) => i).filter((i) => !inUse.has(i)));
    const spare = this.rng.shuffle([...new Set(this.voices.filter((v) => !v.on).map((v) => v.slice))].filter((i) => !playing.has(i)));
    const pool = [...fresh, ...spare];
    for (const i of this.rng.shuffle(rows)) {
      const next = pool.shift();
      if (next === undefined) break;
      const old = this.voices[i].slice;
      // a resting row whose slice was taken gets the old one back
      const rester = this.voices.find((o) => !o.on && o.slice === next);
      if (rester) rester.slice = old;
      this.voices[i].slice = next;
    }
  }

  private dealSlices() {
    const urn = this.rng.shuffle(this.slices.map((_, i) => i));
    this.voices.forEach((v, i) => (v.slice = urn.length ? urn[i % urn.length] : 0));
  }

  private doNewBeat(kickoff: boolean) {
    this.pinned.clear();
    this.held.clear();
    this.voices = Array.from({ length: VOICES }, () => this.blankVoice());
    this.dealSlices();
    for (const v of this.voices) {
      v.human = this.randomHuman();
      v.cents = this.hr.range(-ROW_CENTS, ROW_CENTS);
      v.delaySend = this.rng.range(0, 1);
      v.reverbSend = this.rng.range(0.4, 1);
      this.setPattern(v, this.rng.chance(0.3) ? this.presetPattern() : this.randomPattern());
    }
    this.applySends();
    if (kickoff) {
      // start with one voice on quarter notes; the rest join on a timer
      this.voices[0].on = true;
      this.setPattern(this.voices[0], [...PATTERNS.quarters]);
      this.kickoffStart = this.playing ? this.nextTime : null;
      this.kickoffStage = 0;
      this.settings.autoEvolve = false;
      this.nextEvolveAt = Infinity;
    } else {
      const count = 3 + this.rng.int(4);
      const order = this.rng.shuffle([...Array(VOICES).keys()]);
      order.slice(0, count).forEach((i) => (this.voices[i].on = true));
    }
  }

  /** One random change, chosen like v1.93's driver: six weighted kinds. */
  private doEvolve() {
    if (!this.slices.length) return;
    const on = this.voices.map((v, i) => (v.on ? i : -1)).filter((i) => i >= 0);
    const anyVoice = () => this.rng.int(VOICES);
    // a row you set to a quick pattern keeps its hits
    const loose = on.filter((i) => !this.held.has(i));
    // a row you gave a slice to by hand keeps it
    const free = (i: number) => !this.pinned.has(i);
    const freeOn = on.filter(free);
    const kind = this.rng.weighted([3, 2, 1, 2, 1.5, 0.5]);
    switch (kind) {
      case 0: {
        // flip one step
        if (!loose.length) break;
        const v = this.voices[this.rng.pick(loose)];
        const s = this.rng.int(STEPS);
        v.pattern[s] = !v.pattern[s];
        v.accent[s] = 1;
        break;
      }
      case 1:
        if (loose.length) this.setPattern(this.voices[this.rng.pick(loose)], this.randomPattern());
        break;
      case 2:
        if (loose.length) this.setPattern(this.voices[this.rng.pick(loose)], this.presetPattern());
        break;
      case 3: {
        if (!freeOn.length) break;
        const i = this.rng.pick(freeOn);
        const used = new Set(this.voices.filter((_, j) => j !== i).map((v) => v.slice));
        this.voices[i].slice = this.sliceFor(this.voices[i].role, used);
        break;
      }
      case 4: {
        // a voice joins or drops out; keep between 2 and 7 playing
        const off = this.voices.map((v, i) => (!v.on ? i : -1)).filter((i) => i >= 0);
        const add = on.length <= 2 ? true : on.length >= 7 ? false : this.rng.chance(0.55);
        if (add && off.length) {
          const v = this.voices[this.rng.pick(off)];
          v.on = true;
          if (!v.pattern.some(Boolean)) this.setPattern(v, this.randomPattern());
        } else if (!add && freeOn.length) {
          this.voices[this.rng.pick(freeOn)].on = false;
        }
        break;
      }
      case 5: {
        // three voices get new slices
        for (let k = 0; k < 3; k++) {
          const i = anyVoice();
          if (!free(i)) continue;
          const used = new Set(this.voices.filter((_, j) => j !== i).map((v) => v.slice));
          this.voices[i].slice = this.sliceFor(this.voices[i].role, used);
        }
        break;
      }
    }
  }

  /** 1: second voice joins on eighths, 2: third voice joins, 3: auto-evolve on */
  private doKickoffStage(stage: number) {
    if (stage === 1) {
      this.voices[1].on = true;
      this.setPattern(this.voices[1], [...PATTERNS.eighths]);
    } else if (stage === 2) {
      this.voices[2].on = true;
    } else if (stage === 3) {
      this.applySettings({ autoEvolve: true, evolveEvery: 3 });
    }
  }

  private doRecipe(r: Recipe) {
    this.pinned.clear();
    this.held.clear();
    // a recipe replaces the kickoff
    this.kickoffStart = null;
    this.kickoffStage = 3;
    // set before the voices pick where their humanize walk starts
    this.settings.humanize = r.humanize ?? 1;
    const used = new Set<number>();
    // slice numbers only mean something on the instrument the beat was made
    // with; on any other one (a reVox) every voice picks by role
    const own = refersTo(r.instrument, this.instrument);
    const wanted = r.voices.map((rv) =>
      own && typeof rv.slice === 'number' && rv.slice >= 0 && rv.slice < this.slices.length ? rv.slice : null,
    );
    wanted.forEach((w) => w !== null && used.add(w));
    // then match roles to the slices that suit them
    if (this.scores) {
      const roleOf = (rv: Recipe['voices'][number]) =>
        rv.role && rv.role !== 'any' ? rv.role : (rv.sliceRole ?? rv.role ?? null);
      const roles = r.voices.map((rv, i) => (wanted[i] === null ? roleOf(rv) : null));
      matchSlices(this.scores, roles, used, this.rng).forEach((s, i) => {
        if (s >= 0) {
          wanted[i] = s;
          used.add(s);
        }
      });
    }
    this.voices = Array.from({ length: VOICES }, (_, i) => {
      const rv = r.voices[i];
      const v = this.blankVoice();
      v.delaySend = this.rng.range(0, 0.6);
      v.reverbSend = this.rng.range(0.4, 1);
      if (!rv) {
        v.slice = this.freeSlice(used);
        used.add(v.slice);
        return v;
      }
      const { hits, accent } = parsePattern(rv.pattern);
      v.pattern = hits;
      v.accent = accent;
      v.on = rv.on ?? true;
      v.role = rv.role ?? 'any';
      v.level = Math.min(1, Math.max(0, rv.level ?? 1));
      v.pan = recipePan(rv, r.voices.slice(0, i).filter((o) => panRole(o) === panRole(rv)).length, r.panning);
      v.human = this.randomHuman();
      if (rv.delaySend !== undefined) v.delaySend = rv.delaySend;
      if (rv.reverbSend !== undefined) v.reverbSend = rv.reverbSend;
      if (wanted[i] !== null) v.slice = wanted[i]!;
      else {
        v.slice = this.freeSlice(used);
        used.add(v.slice);
      }
      return v;
    });
    // each row's own slight tuning, drawn last so slice matching is unchanged
    for (const v of this.voices) v.cents = this.hr.range(-ROW_CENTS, ROW_CENTS);
    this.applySends();
    const s: Partial<EngineSettings> = { swing: r.swing ?? 0, humanize: r.humanize ?? this.settings.humanize, autoEvolve: r.evolve?.auto ?? false };
    if (r.bpm !== undefined) s.bpm = r.bpm;
    if (r.pitch !== undefined) s.pitch = r.pitch;
    if (r.evolve?.every !== undefined) s.evolveEvery = r.evolve.every;
    this.applySettings(s);
  }

  private applySettings(s: Partial<EngineSettings>) {
    this.settings = { ...this.settings, ...s, envelope: { ...this.settings.envelope, ...s.envelope } };
    const t = this.ctx.currentTime;
    this.emit({ k: 'tempo', t, bpm: this.settings.bpm });
    if (s.autoEvolve && this.playing && this.nextEvolveAt === Infinity) {
      this.nextEvolveAt = this.nextTime + this.settings.evolveEvery;
    }
    if (s.autoEvolve === false) this.nextEvolveAt = Infinity;
  }

  private applySends() {
    const t = this.ctx.currentTime;
    this.voices.forEach((v, voice) => this.emit({ k: 'sends', t, voice, delay: v.delaySend, reverb: v.reverbSend }));
  }

  // ── transport ─────────────────────────────────────────────────────────

  start() {
    if (this.playing || !this.buffer || !this.slices.length) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.06;
    if (this.kickoffStart === null && this.kickoffStage < 3) this.kickoffStart = this.nextTime;
    if (this.settings.autoEvolve) this.nextEvolveAt = this.nextTime + this.settings.evolveEvery;
    this.timer = setInterval(() => this.schedule(this.ctx.currentTime + LOOKAHEAD), TICK_MS);
    this.schedule(this.ctx.currentTime + LOOKAHEAD);
    this.changed();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    this.cancelCapture('stopped before the capture finished');
    // apply anything still waiting for a downbeat
    for (const a of this.queue.splice(0)) this.run(a);
    this.emit({ k: 'silence', t: this.ctx.currentTime });
    // kickoff and evolve pick up again from GO
    this.kickoffStart = null;
    this.nextEvolveAt = Infinity;
    this.events = [];
    this.changed();
  }

  dispose() {
    this.stop();
    this.bank.dispose();
  }

  /** Steps whose time has come, for the UI. */
  drainEvents(now: number): StepEvent[] {
    let i = 0;
    while (i < this.events.length && this.events[i].time <= now) i++;
    return this.events.splice(0, i);
  }

  /** Schedule every step that starts before `until`. Public so an offline render can drive it. */
  schedule(until: number) {
    while (this.nextTime < until) {
      const t = this.nextTime;
      if (this.step === 0) {
        for (const a of this.queue.splice(0)) this.run(a);
        if (this.cap && !this.cap.tape) this.beginTape(t);
      }
      this.timeline(t);
      this.autoPan(t);
      const stepDur = 60 / this.settings.bpm / 4;
      const ht = this.step % 2 === 1 ? t + this.settings.swing * stepDur : t;
      const hits: number[] = [];
      this.voices.forEach((v, i) => {
        if (v.on && v.pattern[this.step]) {
          // humanize: off the beat, a hit may land a touch late
          const late = this.step % 4 === 0 ? 0 : this.hr.range(0, HUMAN_LATE) * this.settings.humanize;
          this.hit(i, v, ht + late, v.accent[this.step] ?? 1);
          hits.push(i);
        }
      });
      this.events.push({ time: ht, step: this.step, hits });
      this.nextTime += stepDur;
      this.step = (this.step + 1) % STEPS;
      this.absStep++;
      if (this.cap?.tape && --this.cap.stepsLeft === 0) this.endTape();
    }
  }

  private beginTape(t: number) {
    const c = this.cap!;
    c.tape = {
      start: t,
      end: t,
      loops: c.loops,
      bpm: this.settings.bpm,
      head: this.bank.snapshot(t),
      cmds: [],
      recipe: this.toRecipe('Captured beat'),
    };
  }

  private endTape() {
    const c = this.cap!;
    const tape = c.tape!;
    tape.end = this.nextTime;
    this.cap = null;
    c.resolve(tape);
  }

  /** kickoff stages and auto-evolve, on the audio clock */
  private timeline(t: number) {
    if (this.kickoffStart !== null && this.kickoffStage < 3) {
      const el = t - this.kickoffStart;
      const due = [5, 10, 12][this.kickoffStage];
      if (el >= due) {
        this.kickoffStage++;
        this.queue.push({ kind: 'kickoffStage', stage: this.kickoffStage });
        if (this.kickoffStage === 3) this.kickoffStart = null;
      }
    }
    if (t >= this.nextEvolveAt) {
      this.queue.push({ kind: 'evolve', auto: true });
      this.nextEvolveAt = t + this.settings.evolveEvery;
    }
  }

  /** Roaming rows: when a ramp ends, start the next one. */
  private autoPan(t: number) {
    this.pan.forEach((p, i) => {
      const v = this.voices[i];
      if (v.pan.mode !== 'roam' || t + LOOKAHEAD < p.nextAt) return;
      const start = Math.max(p.nextAt, this.ctx.currentTime);
      this.panRamp(i, start, p.value, this.pr.range(v.pan.lo, v.pan.hi), this.pr.range(2, 10), this.pr.pick(['linear', 'sine', 'wobble'] as const), false);
    });
  }

  /**
   * A row's pan setting changed (or a whole new beat came): head for it from
   * wherever the row is now. FIXED glides there in a moment; ROAM starts a new
   * wander, quickly if the row is outside its new range.
   */
  private repan(i: number) {
    const v = this.voices[i];
    const now = this.ctx.currentTime;
    const from = this.panNow(i, now);
    if (v.pan.mode === 'fixed') {
      this.panRamp(i, now, from, v.pan.at, 0.25, 'sine', true);
      this.pan[i].nextAt = Infinity;
      return;
    }
    const inside = from >= v.pan.lo - 0.01 && from <= v.pan.hi + 0.01;
    const dur = inside ? this.pr.range(2, 10) : this.pr.range(0.6, 1.5);
    this.panRamp(i, now, from, this.pr.range(v.pan.lo, v.pan.hi), dur, inside ? this.pr.pick(['linear', 'sine', 'wobble'] as const) : 'sine', true);
  }

  /** Send one pan ramp; `cut` replaces any ramp still running. */
  private panRamp(i: number, start: number, from: number, to: number, dur: number, shape: PanShape, cut: boolean) {
    const n = 32;
    const curve = new Float32Array(n);
    const wob = this.pr.range(1, 3);
    for (let k = 0; k < n; k++) {
      const x = k / (n - 1);
      let y = x;
      if (shape === 'sine') y = 0.5 - 0.5 * Math.cos(Math.PI * x);
      if (shape === 'wobble') y = x + 0.15 * Math.sin(2 * Math.PI * wob * x) * (1 - x);
      curve[k] = Math.max(-1, Math.min(1, from + (to - from) * y));
    }
    this.emit({ k: 'pan', t: start, voice: i, dur, curve, ...(cut ? { cut } : {}) });
    const p = this.pan[i];
    p.value = to;
    p.nextAt = start + dur;
    p.ramp = { t: start, dur, curve };
  }

  /** Where a row's pan is at time `t`. */
  private panNow(i: number, t: number) {
    const r = this.pan[i].ramp;
    if (!r) return this.pan[i].value;
    if (t <= r.t) return r.curve[0];
    if (t >= r.t + r.dur) return r.curve[r.curve.length - 1];
    const f = ((t - r.t) / r.dur) * (r.curve.length - 1);
    const k = Math.min(r.curve.length - 2, Math.floor(f));
    return r.curve[k] + (r.curve[k + 1] - r.curve[k]) * (f - k);
  }

  private hit(i: number, v: Voice, t: number, accent = 1) {
    const s = this.slices[v.slice];
    if (!s || !this.buffer) return;
    const hz = this.settings.humanize;
    // loudness: the slow brownian walk (v1.93), a quick wobble on top, and
    // the second of two running 16ths a little weaker, like a second hand
    const floor = 1 - (1 - HUMAN_FLOOR) * hz;
    v.human = Math.min(1, Math.max(floor, v.human + this.rng.range(-HUMAN_STEP, HUMAN_STEP) * hz));
    v.hand = this.absStep - v.lastAbs === 1 ? 1 - v.hand : 0;
    v.lastAbs = this.absStep;
    const wobble = 1 + this.hr.range(-HUMAN_WOBBLE, HUMAN_WOBBLE) * hz;
    const hand = 1 - v.hand * HUMAN_HAND * hz;
    // pitch: the row's own tuning plus a few cents per hit
    const cents = (v.cents + this.hr.range(-HUMAN_CENTS, HUMAN_CENTS)) * hz;
    const rate = this.settings.pitch * Math.pow(2, cents / 1200);
    // start a few ms into the slice, so no two attacks are identical
    const sliceLen = s.end - s.start;
    const skip = Math.min(HUMAN_START, sliceLen * 0.1) * this.hr.range(0, 1) * hz;
    const sliceDur = (sliceLen - skip) / rate;
    const env = ROLE_ENVELOPE[v.role] ?? this.settings.envelope;
    // the whole slice; the voice's next hit cuts it off (VoiceBank chokes it)
    const len = sliceDur;
    const a = Math.max(0.003, Math.min(env.attack, len / 4));
    const r = Math.max(0.01, Math.min(env.release, len / 4));
    const h = Math.max(0, len - a - r);
    const level = Math.min(1, v.level * v.human * accent * wobble * hand);
    this.emit({ k: 'hit', t, voice: i, offset: s.start + skip, len, rate, level, a, h });
  }

}
