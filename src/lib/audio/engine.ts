// The BeatVox engine, ported from v1.93 (hb.rhyvoice2, hb.trigger,
// hb.voxnode, hb.quadautopan2 and the main patch's kickoff / driver logic).
//
// - 8 voices × 16 sixteenth-note steps, one slice per voice (urn, no repeats)
// - each hit is gated: attack / hold / release (v1.93: 100 / 300 / 100 ms)
//   and a new hit on a voice quickly fades out the previous one
// - velocity: brownian walk between 50 and 110, stepping on each hit
// - auto-pan: a random ramp every 2–10 s per voice (linear, sine or wobbly)
// - New Beat, Evolve and edits land on the next downbeat
// - kickoff: 1 voice, +1 at 5 s, +1 at 10 s, auto-evolve from 12 s every 3 s
//
// All randomness comes from a seeded Rng, and the audio clock drives
// everything (kickoff, evolve, pan), so the same engine can later run in an
// OfflineAudioContext to render the shared MP3.

import { Rng } from './rng';
import type { FxChain } from './fx';
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
};
const PRESET_LIST = [PATTERNS.allOn, PATTERNS.eighths, PATTERNS.quarters, PATTERNS.groove, PATTERNS.allOff];

export type PanShape = 'linear' | 'sine' | 'wobble';

export interface Voice {
  on: boolean;
  slice: number;
  pattern: boolean[];
  /** gain per step (accent 1.25, ghost 0.55); 1 unless a recipe set it */
  accent: number[];
  role: Role;
  velocity: number;
  delaySend: number;
  reverbSend: number;
}

export interface Envelope {
  attack: number;
  hold: number;
  release: number;
}

export interface EngineSettings {
  bpm: number;
  /** playback rate for every hit (v1.93 PITCH) */
  pitch: number;
  /** auto-pan width 0..1 (v1.93 PANNING) */
  panning: number;
  autoEvolve: boolean;
  /** seconds between automatic Evolve changes */
  evolveEvery: number;
  /** 0..0.5 of a step: how late the off-beat sixteenths land */
  swing: number;
  envelope: Envelope;
}

export const DEFAULT_SETTINGS: EngineSettings = {
  bpm: 89,
  pitch: 1,
  panning: 0.6,
  autoEvolve: false,
  evolveEvery: 3,
  swing: 0,
  // v1.93 used 100 ms in; the reference MP3's hits rise in ~50 ms
  envelope: { attack: 0.05, hold: 0.3, release: 0.1 },
};

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
  | { kind: 'toggleStep'; voice: number; step: number }
  | { kind: 'toggleVoice'; voice: number }
  | { kind: 'settings'; settings: Partial<EngineSettings> }
  | { kind: 'recipe'; recipe: Recipe };

const ones = () => Array<number>(STEPS).fill(1);

/** Tighter gates for drum roles; 'any' keeps the v1.93 envelope. */
export const ROLE_ENVELOPE: Partial<Record<Role, Envelope>> = {
  kick: { attack: 0.008, hold: 0.22, release: 0.08 },
  snare: { attack: 0.004, hold: 0.12, release: 0.08 },
  hat: { attack: 0.002, hold: 0.04, release: 0.04 },
  perc: { attack: 0.004, hold: 0.08, release: 0.06 },
  tonal: { attack: 0.02, hold: 0.3, release: 0.12 },
};

interface VoiceNodes {
  input: GainNode;
  panSource: ConstantSourceNode;
  panWidth: GainNode;
  panner: StereoPannerNode;
  delaySend: GainNode;
  reverbSend: GainNode;
}

interface PanState {
  nextAt: number;
  value: number;
}

interface LastHit {
  src: AudioBufferSourceNode;
  choke: GainNode;
  end: number;
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

  private rng: Rng;
  private buffer: AudioBuffer | null = null;
  private slices: Slice[] = [];
  /** drum-role scores per slice */
  private scores: RoleScores[] | null = null;
  private instrument: Instrument | null = null;
  private nodes: VoiceNodes[] = [];
  private pan: PanState[] = [];
  private last: (LastHit | null)[] = [];
  private queue: Action[] = [];
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
    for (let v = 0; v < VOICES; v++) {
      const input = ctx.createGain();
      const panner = ctx.createStereoPanner();
      panner.pan.value = 0;
      const panSource = ctx.createConstantSource();
      panSource.offset.value = 0;
      const panWidth = ctx.createGain();
      panSource.connect(panWidth).connect(panner.pan);
      panSource.start();
      const delaySend = ctx.createGain();
      const reverbSend = ctx.createGain();
      input.connect(panner);
      panner.connect(fx.dry);
      panner.connect(delaySend).connect(fx.delaySend);
      panner.connect(reverbSend).connect(fx.reverbSend);
      this.nodes.push({ input, panSource, panWidth, panner, delaySend, reverbSend });
      this.pan.push({ nextAt: 0, value: 0 });
      this.last.push(null);
    }
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
    this.buffer = buffer;
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
  toggleStep(voice: number, step: number) {
    this.request({ kind: 'toggleStep', voice, step });
  }
  toggleVoice(voice: number) {
    this.request({ kind: 'toggleVoice', voice });
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
      panning: Math.round(st.panning * 100),
      evolve: { auto: st.autoEvolve, every: st.evolveEvery },
      seed: this.rng.seed,
      ...extra,
      voices: this.voices.map((v) => ({
        on: v.on,
        pattern: formatPattern(v.pattern, v.accent),
        role: v.role,
        slice: v.slice,
        sliceRole: this.instrument?.slices[v.slice]?.role,
        velocity: Math.round(v.velocity),
        delaySend: +v.delaySend.toFixed(2),
        reverbSend: +v.reverbSend.toFixed(2),
      })),
    };
  }

  /** Tempo, pitch, panning etc. take effect right away, like v1.93's sliders. */
  set(settings: Partial<EngineSettings>) {
    this.run({ kind: 'settings', settings });
  }

  private request(a: Action) {
    if (this.playing) this.queue.push(a);
    else this.run(a);
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
        this.doEvolve();
        break;
      case 'toggleStep': {
        const v = this.voices[a.voice];
        v.pattern[a.step] = !v.pattern[a.step];
        v.accent[a.step] = 1;
        break;
      }
      case 'toggleVoice':
        this.voices[a.voice].on = !this.voices[a.voice].on;
        break;
      case 'settings':
        this.applySettings(a.settings);
        break;
      case 'recipe':
        this.doRecipe(a.recipe);
        break;
    }
    this.changed();
  }

  private changed() {
    this.version++;
    this.onChange();
  }

  // ── beat generation ───────────────────────────────────────────────────

  private blankVoice(): Voice {
    return { on: false, slice: 0, pattern: [...PATTERNS.allOff], accent: ones(), role: 'any', velocity: 80, delaySend: 0, reverbSend: 0 };
  }

  /** replace a voice's pattern (accents back to normal) */
  private setPattern(v: Voice, hits: boolean[]) {
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

  private dealSlices() {
    const urn = this.rng.shuffle(this.slices.map((_, i) => i));
    this.voices.forEach((v, i) => (v.slice = urn.length ? urn[i % urn.length] : 0));
  }

  private doNewBeat(kickoff: boolean) {
    this.voices = Array.from({ length: VOICES }, () => this.blankVoice());
    this.dealSlices();
    for (const v of this.voices) {
      v.velocity = this.rng.range(50, 110);
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
    const onVoice = () => (on.length ? this.rng.pick(on) : anyVoice());
    const kind = this.rng.weighted([3, 2, 1, 2, 1.5, 0.5]);
    switch (kind) {
      case 0: {
        // flip one step
        const v = this.voices[onVoice()];
        const s = this.rng.int(STEPS);
        v.pattern[s] = !v.pattern[s];
        v.accent[s] = 1;
        break;
      }
      case 1:
        this.setPattern(this.voices[onVoice()], this.randomPattern());
        break;
      case 2:
        this.setPattern(this.voices[onVoice()], this.presetPattern());
        break;
      case 3: {
        const i = onVoice();
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
        } else if (!add && on.length) {
          this.voices[this.rng.pick(on)].on = false;
        }
        break;
      }
      case 5: {
        // three voices get new slices
        for (let k = 0; k < 3; k++) {
          const i = anyVoice();
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
    // a recipe replaces the kickoff
    this.kickoffStart = null;
    this.kickoffStage = 3;
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
      v.velocity = Math.min(110, Math.max(50, rv.velocity ?? 90));
      if (rv.delaySend !== undefined) v.delaySend = rv.delaySend;
      if (rv.reverbSend !== undefined) v.reverbSend = rv.reverbSend;
      if (wanted[i] !== null) v.slice = wanted[i]!;
      else {
        v.slice = this.freeSlice(used);
        used.add(v.slice);
      }
      return v;
    });
    this.applySends();
    const s: Partial<EngineSettings> = { swing: r.swing ?? 0, autoEvolve: r.evolve?.auto ?? false };
    if (r.bpm !== undefined) s.bpm = r.bpm;
    if (r.pitch !== undefined) s.pitch = r.pitch;
    if (r.panning !== undefined) s.panning = r.panning / 100;
    if (r.evolve?.every !== undefined) s.evolveEvery = r.evolve.every;
    this.applySettings(s);
  }

  private applySettings(s: Partial<EngineSettings>) {
    this.settings = { ...this.settings, ...s, envelope: { ...this.settings.envelope, ...s.envelope } };
    const t = this.ctx.currentTime;
    for (const n of this.nodes) n.panWidth.gain.setTargetAtTime(this.settings.panning, t, 0.05);
    this.fx.setTempo(this.settings.bpm);
    if (s.autoEvolve && this.playing && this.nextEvolveAt === Infinity) {
      this.nextEvolveAt = this.nextTime + this.settings.evolveEvery;
    }
    if (s.autoEvolve === false) this.nextEvolveAt = Infinity;
  }

  private applySends() {
    const t = this.ctx.currentTime;
    this.voices.forEach((v, i) => {
      this.nodes[i].delaySend.gain.setTargetAtTime(v.delaySend, t, 0.05);
      this.nodes[i].reverbSend.gain.setTargetAtTime(v.reverbSend, t, 0.05);
    });
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
    // apply anything still waiting for a downbeat
    for (const a of this.queue.splice(0)) this.run(a);
    const t = this.ctx.currentTime;
    for (const h of this.last) {
      if (h && h.end > t) {
        h.choke.gain.setValueAtTime(1, t);
        h.choke.gain.linearRampToValueAtTime(0, t + 0.05);
      }
    }
    // kickoff and evolve pick up again from GO
    this.kickoffStart = null;
    this.nextEvolveAt = Infinity;
    this.events = [];
    this.changed();
  }

  dispose() {
    this.stop();
    for (const n of this.nodes) {
      n.panSource.stop();
      n.input.disconnect();
      n.panner.disconnect();
    }
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
      }
      this.timeline(t);
      this.autoPan(t);
      const stepDur = 60 / this.settings.bpm / 4;
      const ht = this.step % 2 === 1 ? t + this.settings.swing * stepDur : t;
      const hits: number[] = [];
      this.voices.forEach((v, i) => {
        if (v.on && v.pattern[this.step]) {
          this.hit(i, v, ht, v.accent[this.step] ?? 1);
          hits.push(i);
        }
      });
      this.events.push({ time: ht, step: this.step, hits });
      this.nextTime += stepDur;
      this.step = (this.step + 1) % STEPS;
      this.absStep++;
    }
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

  private autoPan(t: number) {
    this.pan.forEach((p, i) => {
      if (t + LOOKAHEAD < p.nextAt) return;
      const start = Math.max(p.nextAt, this.ctx.currentTime);
      const dur = this.rng.range(2, 10);
      const target = this.rng.range(-1, 1);
      const shape: PanShape = this.rng.pick(['linear', 'sine', 'wobble'] as const);
      const n = 32;
      const curve = new Float32Array(n);
      const wob = this.rng.range(1, 3);
      for (let k = 0; k < n; k++) {
        const x = k / (n - 1);
        let y = x;
        if (shape === 'sine') y = 0.5 - 0.5 * Math.cos(Math.PI * x);
        if (shape === 'wobble') y = x + 0.15 * Math.sin(2 * Math.PI * wob * x) * (1 - x);
        curve[k] = Math.max(-1, Math.min(1, p.value + (target - p.value) * y));
      }
      try {
        this.nodes[i].panSource.offset.setValueCurveAtTime(curve, start, dur);
      } catch {
        // overlapping automation (rare after a stop/start); skip this ramp
      }
      p.value = target;
      p.nextAt = start + dur;
    });
  }

  private hit(i: number, v: Voice, t: number, accent = 1) {
    const s = this.slices[v.slice];
    if (!s || !this.buffer) return;
    const ctx = this.ctx;
    // velocity: brownian walk 50–110, one step per hit
    v.velocity = Math.min(110, Math.max(50, v.velocity + this.rng.range(-8, 8)));
    const rate = this.settings.pitch;
    const sliceDur = (s.end - s.start) / rate;
    const env = ROLE_ENVELOPE[v.role] ?? this.settings.envelope;
    const full = env.attack + env.hold + env.release;
    const len = Math.min(sliceDur, full);
    const scale = len / full;
    const a = Math.max(0.003, env.attack * scale);
    const r = Math.max(0.01, env.release * scale);
    const h = Math.max(0, len - a - r);
    const level = (v.velocity / 127) * 1.15 * accent;

    // choke the voice's previous hit
    const prev = this.last[i];
    if (prev && prev.end > t) {
      prev.choke.gain.setValueAtTime(1, t);
      prev.choke.gain.linearRampToValueAtTime(0, t + 0.03);
      try {
        prev.src.stop(t + 0.035);
      } catch {
        /* already stopped */
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + a);
    g.gain.setValueAtTime(level, t + a + h);
    g.gain.linearRampToValueAtTime(0, t + len);
    const choke = ctx.createGain();
    src.connect(g).connect(choke).connect(this.nodes[i].input);
    src.start(t, s.start, len * rate + 0.01);
    src.onended = () => {
      src.disconnect();
      choke.disconnect();
    };
    this.last[i] = { src, choke, end: t + len };
  }
}
