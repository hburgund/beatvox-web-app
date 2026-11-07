// The audio side of the beat engine: 8 voice channels (player → pan →
// dry / delay / reverb sends) feeding the effects chain.
//
// The engine decides *what* happens (which slice, how loud, where it pans)
// and sends each decision here as a small command. Running everything
// through commands means a stretch of a performance can be taped and played
// back exactly into another context, such as an OfflineAudioContext that
// renders the shared MP3 (see render.ts).

import type { FxChain, FxParams } from './fx';

export const VOICE_CHANNELS = 8;

export type Cmd =
  /** play a slice: gate up over `a`, hold until `h`, down to 0 at `len` */
  | { k: 'hit'; t: number; voice: number; offset: number; len: number; rate: number; level: number; a: number; h: number }
  /** an auto-pan ramp (values -1..1, scaled by the pan width) */
  | { k: 'pan'; t: number; voice: number; dur: number; curve: Float32Array }
  | { k: 'width'; t: number; value: number }
  | { k: 'sends'; t: number; voice: number; delay: number; reverb: number }
  | { k: 'fx'; t: number; params: FxParams }
  | { k: 'tempo'; t: number; bpm: number }
  /** fade out every hit still sounding (STOP) */
  | { k: 'silence'; t: number };

interface Channel {
  input: GainNode;
  panSource: ConstantSourceNode;
  panWidth: GainNode;
  delaySend: GainNode;
  reverbSend: GainNode;
  panner: StereoPannerNode;
}

interface LastHit {
  src: AudioBufferSourceNode;
  choke: GainNode;
  end: number;
}

type PanCmd = Extract<Cmd, { k: 'pan' }>;

export class VoiceBank {
  private channels: Channel[] = [];
  private last: (LastHit | null)[] = [];
  private buffer: AudioBuffer | null = null;

  // what was last asked for, so a tape can start mid-performance
  private width = 0;
  private sends: { delay: number; reverb: number }[] = [];
  private pans: PanCmd[][] = [];
  private fxParams: FxParams;
  private bpm = 89;

  constructor(
    private ctx: BaseAudioContext,
    private fx: FxChain,
  ) {
    for (let v = 0; v < VOICE_CHANNELS; v++) {
      const input = ctx.createGain();
      const panner = ctx.createStereoPanner();
      panner.pan.value = 0;
      const panSource = ctx.createConstantSource();
      panSource.offset.value = 0;
      const panWidth = ctx.createGain();
      panWidth.gain.value = 0;
      panSource.connect(panWidth).connect(panner.pan);
      panSource.start();
      const delaySend = ctx.createGain();
      delaySend.gain.value = 0;
      const reverbSend = ctx.createGain();
      reverbSend.gain.value = 0;
      input.connect(panner);
      panner.connect(fx.dry);
      panner.connect(delaySend).connect(fx.delaySend);
      panner.connect(reverbSend).connect(fx.reverbSend);
      this.channels.push({ input, panSource, panWidth, delaySend, reverbSend, panner });
      this.last.push(null);
      this.sends.push({ delay: 0, reverb: 0 });
      this.pans.push([]);
    }
    this.fxParams = { ...fx.params };
  }

  setBuffer(buffer: AudioBuffer) {
    this.buffer = buffer;
  }

  apply(c: Cmd) {
    switch (c.k) {
      case 'hit':
        return this.hit(c);
      case 'pan':
        try {
          this.channels[c.voice].panSource.offset.setValueCurveAtTime(c.curve, c.t, c.dur);
        } catch {
          // overlapping automation (rare after a stop/start); skip this ramp
        }
        this.pans[c.voice] = [...this.pans[c.voice].slice(-2), c];
        return;
      case 'width':
        this.width = c.value;
        for (const ch of this.channels) ch.panWidth.gain.setTargetAtTime(c.value, c.t, 0.05);
        return;
      case 'sends': {
        const ch = this.channels[c.voice];
        ch.delaySend.gain.setTargetAtTime(c.delay, c.t, 0.05);
        ch.reverbSend.gain.setTargetAtTime(c.reverb, c.t, 0.05);
        this.sends[c.voice] = { delay: c.delay, reverb: c.reverb };
        return;
      }
      case 'fx':
        this.fxParams = { ...c.params };
        this.fx.set(c.params, c.t);
        return;
      case 'tempo':
        this.bpm = c.bpm;
        this.fx.setTempo(c.bpm, c.t);
        return;
      case 'silence':
        for (const h of this.last) {
          if (h && h.end > c.t) {
            h.choke.gain.setValueAtTime(1, c.t);
            h.choke.gain.linearRampToValueAtTime(0, c.t + 0.05);
          }
        }
        return;
    }
  }

  /**
   * Commands that recreate the current state at time `at`: effects, tempo,
   * pan width, sends, and any pan ramps still running (cut to start at `at`).
   */
  snapshot(at: number): Cmd[] {
    const out: Cmd[] = [
      { k: 'fx', t: at, params: { ...this.fxParams } },
      { k: 'tempo', t: at, bpm: this.bpm },
      { k: 'width', t: at, value: this.width },
    ];
    this.sends.forEach((s, voice) => out.push({ k: 'sends', t: at, voice, ...s }));
    this.pans.forEach((list) => {
      for (const p of list) {
        const end = p.t + p.dur;
        if (end <= at) continue;
        out.push(p.t >= at ? p : cutCurve(p, at));
      }
    });
    return out;
  }

  private hit(c: Extract<Cmd, { k: 'hit' }>) {
    if (!this.buffer) return;
    const { t } = c;
    // choke the voice's previous hit
    const prev = this.last[c.voice];
    if (prev && prev.end > t) {
      prev.choke.gain.setValueAtTime(1, t);
      prev.choke.gain.linearRampToValueAtTime(0, t + 0.03);
      try {
        prev.src.stop(t + 0.035);
      } catch {
        /* already stopped */
      }
    }
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = c.rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(c.level, t + c.a);
    g.gain.setValueAtTime(c.level, t + c.a + c.h);
    g.gain.linearRampToValueAtTime(0, t + c.len);
    const choke = ctx.createGain();
    src.connect(g).connect(choke).connect(this.channels[c.voice].input);
    src.start(t, c.offset, c.len * c.rate + 0.01);
    src.onended = () => {
      src.disconnect();
      choke.disconnect();
    };
    this.last[c.voice] = { src, choke, end: t + c.len };
  }

  dispose() {
    for (const ch of this.channels) {
      ch.panSource.stop();
      ch.input.disconnect();
      ch.panner.disconnect();
    }
  }
}

/** The part of a pan ramp from `at` on, as a ramp of its own. */
export function cutCurve(p: PanCmd, at: number): PanCmd {
  const n = p.curve.length;
  const end = p.t + p.dur;
  const x0 = (at - p.t) / p.dur;
  const m = Math.max(2, Math.ceil(n * (1 - x0)));
  const curve = new Float32Array(m);
  for (let k = 0; k < m; k++) {
    // sample the old curve at the matching point, linearly
    const x = x0 + (1 - x0) * (k / (m - 1));
    const f = x * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    curve[k] = p.curve[i] + (p.curve[i + 1] - p.curve[i]) * (f - i);
  }
  return { ...p, t: at, dur: end - at, curve };
}
