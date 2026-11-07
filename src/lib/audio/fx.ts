// Master effects: per-voice sends into delay and reverb, then EQ,
// compression ("glue", standing in for the Waves RVox), master volume and a
// limiter. Built on BaseAudioContext so the same chain can run offline when
// rendering the shared MP3.
//
//   voices ─► dry ──────────────┐
//          └► delay send ─► delay ─┼─► EQ ─► comp ─► volume ─► limiter ─► out
//          └► reverb send ─► room/hall ┘

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
}

export const FX_PRESETS: Record<string, FxParams> = {
  Dry: { lowCut: 90, presence: 2, compThreshold: -18, compRatio: 3, delaySteps: 3, delayFeedback: 0.3, delayTone: 3500, delayMix: 0, reverbMix: 0, reverbSize: 0 },
  Room: { lowCut: 90, presence: 2, compThreshold: -18, compRatio: 3, delaySteps: 3, delayFeedback: 0.3, delayTone: 3500, delayMix: 0, reverbMix: 0.22, reverbSize: 0 },
  Hall: { lowCut: 90, presence: 2, compThreshold: -18, compRatio: 3, delaySteps: 3, delayFeedback: 0.3, delayTone: 3500, delayMix: 0.08, reverbMix: 0.32, reverbSize: 1 },
  Dub: { lowCut: 110, presence: 1, compThreshold: -20, compRatio: 4, delaySteps: 3, delayFeedback: 0.55, delayTone: 1800, delayMix: 0.4, reverbMix: 0.18, reverbSize: 0.5 },
  Space: { lowCut: 110, presence: 3, compThreshold: -20, compRatio: 3, delaySteps: 4, delayFeedback: 0.5, delayTone: 2500, delayMix: 0.3, reverbMix: 0.5, reverbSize: 1 },
};

/** Simple mode's single "Space" knob, 0..1: dry → room → hall → hall with echoes. */
export function spaceToParams(space: number): FxParams {
  const s = Math.min(1, Math.max(0, space));
  return {
    ...FX_PRESETS.Dry,
    reverbMix: 0.5 * Math.sqrt(s),
    reverbSize: Math.min(1, Math.max(0, (s - 0.25) / 0.5)),
    delayMix: s > 0.55 ? ((s - 0.55) / 0.45) * 0.3 : 0,
    delayFeedback: 0.3 + 0.2 * s,
  };
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

export class FxChain {
  /** connect voices' dry signal here */
  readonly dry: GainNode;
  readonly delaySend: GainNode;
  readonly reverbSend: GainNode;
  readonly output: GainNode;

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
    this.sum = g();
    this.output = g();

    // delay with filtered feedback
    this.delay = ctx.createDelay(2);
    this.feedback = g(0.3);
    this.delayLp = ctx.createBiquadFilter();
    this.delayLp.type = 'lowpass';
    this.delayReturn = g(0);
    this.delaySend.connect(this.delay);
    this.delay.connect(this.delayLp).connect(this.feedback).connect(this.delay);
    this.delayLp.connect(this.delayReturn).connect(this.sum);
    // a little of the echo goes into the reverb too
    this.delayLp.connect(g(0.3)).connect(this.reverbSend);

    // two reverbs, crossfaded by size
    const room = ctx.createConvolver();
    room.buffer = makeImpulse(ctx, 0.9, 0.008, 0.6, 7);
    const hall = ctx.createConvolver();
    hall.buffer = makeImpulse(ctx, 3.2, 0.025, 0.8, 11);
    this.roomReturn = g(0);
    this.hallReturn = g(0);
    this.reverbSend.connect(room).connect(this.roomReturn).connect(this.sum);
    this.reverbSend.connect(hall).connect(this.hallReturn).connect(this.sum);

    this.dry.connect(this.sum);

    // master: EQ → comp → makeup → volume → limiter
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
    // rough make-up gain for the compression
    ramp(this.makeup.gain, Math.pow(10, (-q.compThreshold * (1 - 1 / q.compRatio)) / 20 / 2.5));
    ramp(this.feedback.gain, Math.min(0.85, q.delayFeedback));
    ramp(this.delayLp.frequency, q.delayTone);
    ramp(this.delayReturn.gain, q.delayMix * 1.6);
    ramp(this.roomReturn.gain, q.reverbMix * (1 - q.reverbSize) * 1.4);
    ramp(this.hallReturn.gain, q.reverbMix * q.reverbSize * 1.1);
    this.setTempo(60 / this.stepDur / 4, when);
  }

  /** keeps the delay locked to the beat */
  setTempo(bpm: number, when = this.ctx.currentTime) {
    this.stepDur = 60 / bpm / 4;
    this.delay.delayTime.setTargetAtTime(Math.min(2, this.stepDur * this.params.delaySteps), when, 0.08);
  }

  setVolume(v: number, when = this.ctx.currentTime) {
    this.volume.gain.setTargetAtTime(v, when, 0.03);
  }

  disconnect() {
    this.output.disconnect();
  }
}
