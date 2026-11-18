// Master effects: the effects rack. Six one-knob effects, each off at 0 and
// stronger as it turns up (see knobsToParams for what each knob does):
//
//   CRUSH → FILTER → WOBBLE → ECHO → SPACE → PUMP → glue → volume → limiter
//
// Each row of the beat sends a little of itself to the echo and the reverb
// (amounts the engine rolls per row, so echoes land on some sounds and not
// others). So the "colour" effects that come before them (crush, filter,
// wobble) run three times, once on the dry sum and once on each send, all
// on the same settings and the same wobble LFO:
//
//   rows ─► dry ─────► colour ──────────────────────┐
//        └► echo send ─► colour ─► delay ─┬──────────┼─► sum ─► EQ ─► comp ─► pump ─► volume ─► limiter ─► out
//        └► reverb send ─► colour ─┬◄────┘ (a bit)   │
//                                  └► room/hall ─────┘
//   clean (the original voice in the shared MP3) ────► sum
//
// Everything is a built-in node with automatable settings (no worklets, no
// curves that change), so a capture taped as commands renders the same
// offline (render.ts), knob turns and all. PUMP ducks the mix on every beat,
// so the engine sends it a 'pump' command per quarter note.

import { Rng } from './rng';

export interface FxParams {
  /** low cut ("reduce bass"), Hz */
  lowCut: number;
  /** presence boost around 3 kHz, dB */
  presence: number;
  compThreshold: number;
  compRatio: number;
  /** delay time in sixteenth notes (2 = 1/8, 3 = dotted 1/8, 4 = 1/4) */
  delaySteps: number;
  delayFeedback: number;
  /** delay feedback low-pass, Hz */
  delayTone: number;
  delayMix: number;
  reverbMix: number;
  /** 0 = small room, 1 = big hall */
  reverbSize: number;
  /** 0..1: saturation, then bit-crush */
  crush?: number;
  /** -1..1: low-pass to the left, high-pass to the right, off at 0 */
  filter?: number;
  /** 0..1: chorus, flanger, warble */
  wobble?: number;
  /** 0..1: how hard the mix ducks on each beat */
  pump?: number;
}

/** The knobs of the effects rack, as the UI and recipes keep them. */
export interface FxKnobs {
  /** 0..100 */
  crush: number;
  /** -100..100, 0 = off */
  filter: number;
  /** 0..100 */
  wobble: number;
  /** 0..100 */
  echo: number;
  /** the echo's time in sixteenths: 2 = 1/8, 3 = dotted 1/8, 4 = 1/4 */
  echoTime: number;
  /** 0..100 */
  pump: number;
}

export const ECHO_TIMES = [2, 3, 4] as const;
export const FX_KNOBS_OFF: FxKnobs = { crush: 0, filter: 0, wobble: 0, echo: 0, echoTime: 3, pump: 0 };

export const FX_PRESETS: Record<string, FxParams> = {
  Dry: { lowCut: 90, presence: 2, compThreshold: -18, compRatio: 3, delaySteps: 3, delayFeedback: 0.3, delayTone: 3500, delayMix: 0, reverbMix: 0, reverbSize: 0 },
  Room: { lowCut: 90, presence: 2, compThreshold: -18, compRatio: 3, delaySteps: 3, delayFeedback: 0.3, delayTone: 3500, delayMix: 0, reverbMix: 0.22, reverbSize: 0 },
  Hall: { lowCut: 90, presence: 2, compThreshold: -18, compRatio: 3, delaySteps: 3, delayFeedback: 0.3, delayTone: 3500, delayMix: 0.08, reverbMix: 0.32, reverbSize: 1 },
  Dub: { lowCut: 110, presence: 1, compThreshold: -20, compRatio: 4, delaySteps: 3, delayFeedback: 0.55, delayTone: 1800, delayMix: 0.4, reverbMix: 0.18, reverbSize: 0.5 },
  Space: { lowCut: 110, presence: 3, compThreshold: -20, compRatio: 3, delaySteps: 4, delayFeedback: 0.5, delayTone: 2500, delayMix: 0.3, reverbMix: 0.5, reverbSize: 1 },
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

/** The Space knob, 0..1: dry → room → hall → hall with echoes. */
export function spaceToParams(space: number): FxParams {
  const s = clamp01(space);
  return {
    ...FX_PRESETS.Dry,
    reverbMix: 0.5 * Math.sqrt(s),
    reverbSize: clamp01((s - 0.25) / 0.5),
    delayMix: s > 0.55 ? ((s - 0.55) / 0.45) * 0.3 : 0,
    delayFeedback: 0.3 + 0.2 * s,
  };
}

/** Every knob of the rack (Space 0..100 too) as the chain's settings. */
export function knobsToParams(space: number, k: FxKnobs): FxParams {
  const p = spaceToParams(space / 100);
  // ECHO: a few quiet echoes → clear rhythmic ones → dub runaway, darker as it builds
  const e = clamp01(k.echo / 100);
  p.delaySteps = ECHO_TIMES.includes(k.echoTime as 2) ? k.echoTime : 3;
  if (e > 0) {
    p.delayMix = Math.max(p.delayMix, 0.1 + 0.45 * Math.pow(e, 0.8));
    p.delayFeedback = Math.max(p.delayFeedback, 0.22 + 0.6 * Math.pow(e, 1.4));
    p.delayTone = 4500 * Math.pow(1500 / 4500, e);
  }
  // PUMP: more glue first, then the beat-by-beat ducking (in FxChain.pump)
  const u = clamp01(k.pump / 100);
  p.compThreshold = -18 - 12 * clamp01(u / 0.6);
  p.compRatio = 3 + 4 * clamp01(u / 0.6);
  p.pump = u;
  p.crush = clamp01(k.crush / 100);
  p.filter = Math.min(1, Math.max(-1, k.filter / 100));
  p.wobble = clamp01(k.wobble / 100);
  return p;
}

/** Generated stereo impulse response: decaying noise that darkens over time. */
export function makeImpulse(ctx: BaseAudioContext, seconds: number, preDelay: number, damping: number, seed = 1): AudioBuffer {
  const sr = ctx.sampleRate;
  const pre = Math.round(preDelay * sr);
  const len = pre + Math.round(seconds * sr);
  const ir = ctx.createBuffer(2, len, sr);
  const rng = new Rng(seed);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      // -60 dB at `seconds`
      const env = Math.pow(10, (-3 * t) / seconds);
      // one-pole low-pass that closes as the tail goes on
      const k = Math.max(0.03, 1 - damping * (t / seconds) - 0.15);
      lp += k * (rng.range(-1, 1) - lp);
      d[i] = lp * env;
    }
    // soften the first few ms so the reverb doesn't click
    for (let i = 0; i < Math.min(len - pre, sr * 0.004); i++) d[pre + i] *= i / (sr * 0.004);
  }
  return ir;
}

// ── the colour stage: CRUSH → FILTER → WOBBLE ───────────────────────────

/** steps per unit in the bit-crush curve: 8 bits at unity gain in front of it */
const CRUSH_STEPS = 128;
const SAT_K = 3;

let satCurve: Float32Array | null = null;
let stairCurve: Float32Array | null = null;
function curves() {
  if (!satCurve || !stairCurve) {
    const n = 4096;
    satCurve = new Float32Array(n);
    for (let i = 0; i < n; i++) satCurve[i] = Math.tanh(SAT_K * ((i / (n - 1)) * 2 - 1));
    // fine enough that the shaper's interpolation between points keeps the steps sharp
    const m = 65536;
    stairCurve = new Float32Array(m);
    for (let i = 0; i < m; i++) stairCurve[i] = Math.round(((i / (m - 1)) * 2 - 1) * CRUSH_STEPS) / CRUSH_STEPS;
  }
  return { sat: satCurve, stair: stairCurve };
}

/** what the CRUSH knob (0..1) sets */
export function crushSettings(c: number) {
  const x = clamp01(c);
  // drive into tanh: 0.05 is all but clean, 2.5 is heavy
  const drive = 0.05 + 2.5 * Math.pow(clamp01(x / 0.65), 1.6);
  const satGain = 1 / Math.tanh(SAT_K * drive) / (1 + 0.5 * Math.max(0, drive - 0.3));
  // bit-crush fades in from 0.45, from 8 bits down to 3
  const mix = clamp01((x - 0.45) / 0.25);
  const bits = x <= 0.45 ? 8 : 8 - 5 * ((x - 0.45) / 0.55);
  const pre = Math.pow(2, bits - 1) / CRUSH_STEPS;
  return { drive, satGain, mix, pre, post: 1 / pre };
}

/** what the FILTER knob (-1..1) sets; a little dead zone round the middle */
export function filterSettings(f: number) {
  const x = Math.min(1, Math.max(-1, f));
  const a = clamp01((Math.abs(x) - 0.04) / 0.96);
  const lp = x < 0 && a > 0 ? 20000 * Math.pow(250 / 20000, a) : 20000;
  const hp = x > 0 && a > 0 ? 20 * Math.pow(2500 / 20, a) : 20;
  // resonance (dB, as Web Audio's low/high-pass Q is) grows toward the ends
  const q = a > 0 ? 1 + 11 * Math.pow(a, 1.5) : 0;
  // the high-pass takes most of the energy away: give a little back
  const gain = x > 0 ? Math.pow(10, (5 * a) / 20) : 1;
  return { lp, hp, lpQ: x < 0 ? q : 0, hpQ: x > 0 ? q : 0, gain };
}

// WOBBLE, through its anchors: off, chorus, more chorus, flanger, warble
const WOBBLE_AT = [0, 0.15, 0.4, 0.65, 1];
const WOBBLE = {
  base: [0.012, 0.012, 0.012, 0.0025, 0.009],
  depth: [0.002, 0.0025, 0.004, 0.002, 0.007],
  rate: [0.6, 0.7, 0.9, 0.3, NaN], // NaN: on the beat (one sweep per two beats)
  feedback: [0, 0, 0.1, 0.7, 0.2],
  wet: [0, 0.3, 0.5, 0.5, 1],
  dry: [1, 1, 0.85, 0.7, 0],
};

/** what the WOBBLE knob (0..1) sets, at `bpm` */
export function wobbleSettings(w: number, bpm: number) {
  const x = clamp01(w);
  let i = 0;
  while (i < WOBBLE_AT.length - 2 && x > WOBBLE_AT[i + 1]) i++;
  const f = (x - WOBBLE_AT[i]) / (WOBBLE_AT[i + 1] - WOBBLE_AT[i]);
  const at = (a: number[]) => {
    const b = a.map((v) => (Number.isNaN(v) ? bpm / 60 / 2 : v));
    return lerp(b[i], b[i + 1], f);
  };
  return { base: at(WOBBLE.base), depth: at(WOBBLE.depth), rate: at(WOBBLE.rate), feedback: at(WOBBLE.feedback), wet: at(WOBBLE.wet), dry: at(WOBBLE.dry) };
}

class Colour {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly wobble: DelayNode;
  private drive: GainNode;
  private satGain: GainNode;
  private satOut: GainNode;
  private crushPre: GainNode;
  private crushPost: GainNode;
  private crushOut: GainNode;
  private hp: BiquadFilterNode;
  private lp: BiquadFilterNode;
  private filterGain: GainNode;
  private dry: GainNode;
  private wet: GainNode;
  private feedback: GainNode;
  private nyquist: number;

  constructor(ctx: BaseAudioContext) {
    this.nyquist = ctx.sampleRate / 2;
    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    const { sat, stair } = curves();
    this.input = g();
    this.output = g();
    this.drive = g();
    const satShaper = ctx.createWaveShaper();
    satShaper.curve = sat as Float32Array<ArrayBuffer>;
    satShaper.oversample = '4x';
    this.satGain = g();
    this.satOut = g();
    this.crushPre = g();
    const stairShaper = ctx.createWaveShaper();
    stairShaper.curve = stair as Float32Array<ArrayBuffer>;
    this.crushPost = g();
    this.crushOut = g(0);
    const mixed = g();
    this.input.connect(this.drive).connect(satShaper).connect(this.satGain);
    this.satGain.connect(this.satOut).connect(mixed);
    this.satGain.connect(this.crushPre).connect(stairShaper).connect(this.crushPost).connect(this.crushOut).connect(mixed);

    this.hp = ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.filterGain = g();
    mixed.connect(this.hp).connect(this.lp).connect(this.filterGain);

    this.dry = g();
    this.wet = g(0);
    this.feedback = g(0);
    this.wobble = ctx.createDelay(0.05);
    this.filterGain.connect(this.dry).connect(this.output);
    this.filterGain.connect(this.wobble).connect(this.wet).connect(this.output);
    this.wobble.connect(this.feedback).connect(this.wobble);
  }

  set(q: FxParams, bpm: number, ramp: (p: AudioParam, v: number) => void) {
    const c = crushSettings(q.crush ?? 0);
    ramp(this.drive.gain, c.drive);
    ramp(this.satGain.gain, c.satGain);
    ramp(this.satOut.gain, 1 - c.mix);
    ramp(this.crushPre.gain, c.pre);
    ramp(this.crushPost.gain, c.post);
    ramp(this.crushOut.gain, c.mix);
    const f = filterSettings(q.filter ?? 0);
    ramp(this.hp.frequency, f.hp);
    ramp(this.hp.Q, f.hpQ);
    ramp(this.lp.frequency, Math.min(f.lp, this.nyquist * 0.9));
    ramp(this.lp.Q, f.lpQ);
    ramp(this.filterGain.gain, f.gain);
    const w = wobbleSettings(q.wobble ?? 0, bpm);
    ramp(this.wobble.delayTime, w.base);
    ramp(this.feedback.gain, w.feedback);
    ramp(this.wet.gain, w.wet);
    ramp(this.dry.gain, w.dry);
  }
}

export class FxChain {
  /** connect voices' dry signal here */
  readonly dry: GainNode;
  readonly delaySend: GainNode;
  readonly reverbSend: GainNode;
  /** straight to the master, past the rack (the original voice in the MP3) */
  readonly clean: GainNode;
  readonly output: GainNode;

  private colours: Colour[];
  private lfo: OscillatorNode;
  private lfoDepth: GainNode;
  private sum: GainNode;
  private delay: DelayNode;
  private feedback: GainNode;
  private delayLp: BiquadFilterNode;
  private delayReturn: GainNode;
  private roomReturn: GainNode;
  private hallReturn: GainNode;
  private lowCut: BiquadFilterNode;
  private presence: BiquadFilterNode;
  private comp: DynamicsCompressorNode;
  private makeup: GainNode;
  private duck: GainNode;
  private pumpMakeup: GainNode;
  private volume: GainNode;
  private limiter: DynamicsCompressorNode;
  private stepDur = 60 / 89 / 4;
  params: FxParams = { ...FX_PRESETS.Dry };

  constructor(private ctx: BaseAudioContext, destination: AudioNode = ctx.destination) {
    const g = (v = 1) => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    this.dry = g();
    this.delaySend = g();
    this.reverbSend = g();
    this.clean = g();
    this.sum = g();
    this.output = g();

    // the colour stage, three times over, on one wobble LFO
    this.colours = [new Colour(ctx), new Colour(ctx), new Colour(ctx)];
    const [dryC, delayC, reverbC] = this.colours;
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfoDepth = g(0);
    this.lfo.connect(this.lfoDepth);
    for (const c of this.colours) this.lfoDepth.connect(c.wobble.delayTime);
    this.lfo.start();
    this.dry.connect(dryC.input);
    dryC.output.connect(this.sum);
    this.delaySend.connect(delayC.input);
    this.reverbSend.connect(reverbC.input);
    const reverbIn = g();
    reverbC.output.connect(reverbIn);

    // delay with filtered feedback
    this.delay = ctx.createDelay(2);
    this.feedback = g(0.3);
    this.delayLp = ctx.createBiquadFilter();
    this.delayLp.type = 'lowpass';
    this.delayReturn = g(0);
    delayC.output.connect(this.delay);
    this.delay.connect(this.delayLp).connect(this.feedback).connect(this.delay);
    this.delayLp.connect(this.delayReturn).connect(this.sum);
    // a little of the echo goes into the reverb too
    this.delayLp.connect(g(0.3)).connect(reverbIn);

    // two reverbs, crossfaded by size
    const room = ctx.createConvolver();
    room.buffer = makeImpulse(ctx, 0.9, 0.008, 0.6, 7);
    const hall = ctx.createConvolver();
    hall.buffer = makeImpulse(ctx, 3.2, 0.025, 0.8, 11);
    this.roomReturn = g(0);
    this.hallReturn = g(0);
    reverbIn.connect(room).connect(this.roomReturn).connect(this.sum);
    reverbIn.connect(hall).connect(this.hallReturn).connect(this.sum);

    this.clean.connect(this.sum);

    // master: EQ → comp → makeup → pump → volume → limiter
    this.lowCut = ctx.createBiquadFilter();
    this.lowCut.type = 'highpass';
    this.lowCut.Q.value = 0.7;
    this.presence = ctx.createBiquadFilter();
    this.presence.type = 'peaking';
    this.presence.frequency.value = 3200;
    this.presence.Q.value = 0.8;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.knee.value = 8;
    this.comp.attack.value = 0.005;
    this.comp.release.value = 0.12;
    this.makeup = g(1);
    this.duck = g(1);
    this.pumpMakeup = g(1);
    this.volume = g(0.8);
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1.5;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.08;
    this.sum
      .connect(this.lowCut)
      .connect(this.presence)
      .connect(this.comp)
      .connect(this.makeup)
      .connect(this.duck)
      .connect(this.pumpMakeup)
      .connect(this.volume)
      .connect(this.limiter)
      .connect(this.output)
      .connect(destination);

    this.set(this.params);
  }

  set(p: Partial<FxParams>, when = this.ctx.currentTime) {
    this.params = { ...this.params, ...p };
    const q = this.params;
    const ramp = (param: AudioParam, v: number) => param.setTargetAtTime(v, when, 0.05);
    ramp(this.lowCut.frequency, q.lowCut);
    ramp(this.presence.gain, q.presence);
    ramp(this.comp.threshold, q.compThreshold);
    ramp(this.comp.ratio, q.compRatio);
    // rough make-up gain for the compression; PUMP's heavier squeeze gets no more than a touch
    ramp(this.makeup.gain, Math.pow(10, Math.min(6, (-q.compThreshold * (1 - 1 / q.compRatio)) / 2.5) / 20));
    ramp(this.pumpMakeup.gain, Math.pow(10, (pumpDepthDb(q.pump ?? 0) * 0.2) / 20));
    ramp(this.feedback.gain, Math.min(0.85, q.delayFeedback));
    ramp(this.delayLp.frequency, q.delayTone);
    ramp(this.delayReturn.gain, q.delayMix * 1.6);
    ramp(this.roomReturn.gain, q.reverbMix * (1 - q.reverbSize) * 1.4);
    ramp(this.hallReturn.gain, q.reverbMix * q.reverbSize * 1.1);
    this.setTempo(60 / this.stepDur / 4, when);
  }

  /** keeps the delay and the wobble locked to the beat */
  setTempo(bpm: number, when = this.ctx.currentTime) {
    this.stepDur = 60 / bpm / 4;
    this.delay.delayTime.setTargetAtTime(Math.min(2, this.stepDur * this.params.delaySteps), when, 0.08);
    const ramp = (param: AudioParam, v: number) => param.setTargetAtTime(v, when, 0.05);
    const w = wobbleSettings(this.params.wobble ?? 0, bpm);
    ramp(this.lfo.frequency, w.rate);
    ramp(this.lfoDepth.gain, w.depth);
    for (const c of this.colours) c.set(this.params, bpm, ramp);
  }

  /** PUMP: duck the whole mix on the beat at `t`, letting its first hit through */
  pump(t: number) {
    const db = pumpDepthDb(this.params.pump ?? 0);
    if (db <= 0) return;
    const low = Math.pow(10, -db / 20);
    const beat = this.stepDur * 4;
    this.duck.gain.setTargetAtTime(low, t + 0.025, 0.012);
    this.duck.gain.setTargetAtTime(1, t + 0.08, beat * 0.3);
  }

  setVolume(v: number, when = this.ctx.currentTime) {
    this.volume.gain.setTargetAtTime(v, when, 0.03);
  }

  disconnect() {
    this.output.disconnect();
    try {
      this.lfo.stop();
    } catch {
      /* not started */
    }
  }
}

/** how far PUMP ducks the mix on each beat, dB: nothing until 0.2, then up to 15 */
export function pumpDepthDb(pump: number) {
  return pump < 0.2 ? 0 : ((pump - 0.2) / 0.8) * 15;
}

/**
 * RANDOMIZE!: new settings for every knob of the rack. Each knob lands off,
 * a little or a lot; at least two move clearly from where they were, and
 * now and then (one in six) it goes wild.
 */
export function randomKnobs(now: FxKnobs, rng: () => number = Math.random): FxKnobs {
  const wild = rng() < 1 / 6;
  const roll = (a: number, b: number) => a + (b - a) * rng();
  const level = () => {
    const r = rng();
    if (wild) return r < 0.15 ? 0 : r < 0.4 ? roll(25, 55) : roll(55, 100);
    return r < 0.35 ? 0 : r < 0.75 ? roll(15, 45) : roll(45, 90);
  };
  for (let tries = 0; ; tries++) {
    const k: FxKnobs = {
      crush: level(),
      // the filter leans to the middle: extremes are rare
      filter: (rng() < 0.5 ? -1 : 1) * (rng() < 0.4 ? 0 : Math.pow(rng(), 1.6) * (wild ? 95 : 70)),
      wobble: level(),
      echo: level(),
      echoTime: ECHO_TIMES[Math.floor(rng() * ECHO_TIMES.length)],
      pump: level(),
    };
    for (const n of ['crush', 'filter', 'wobble', 'echo', 'pump'] as const) k[n] = Math.round(k[n]);
    const moved = (['crush', 'filter', 'wobble', 'echo', 'pump'] as const).filter((n) => Math.abs(k[n] - now[n]) >= 25).length;
    const heavy = (['crush', 'wobble', 'echo', 'pump'] as const).filter((n) => k[n] >= 55).length + (Math.abs(k.filter) >= 55 ? 1 : 0);
    if (moved >= 2 && (!wild || heavy >= 3)) return k;
    if (tries > 50) return k;
  }
}
