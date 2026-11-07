// A small stand-in for the v1.93 beat engine, used to judge slices by ear:
// N voices × 16 sixteenth-note steps, one slice per voice (no repeats),
// a humanize walk on each hit's loudness, fixed random pan, look-ahead scheduling.

import type { Slice } from './slicer';

export const STEPS = 16;
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

const PRESETS = [
  '1000100010001000', // quarters
  '1010101010101010', // eighths
  '1001011000010111', // the v1.93 "groove"
];

export interface Voice {
  slice: number;
  pattern: boolean[];
  pan: number;
  /** humanize multiplier, wanders 0.45–1 */
  human: number;
}

export interface Hit { voice: number; slice: number; step: number; time: number }

export class BeatPreview {
  voices: Voice[] = [];
  bpm = 89;
  playing = false;
  private nextTime = 0;
  private step = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private last: ({ src: AudioBufferSourceNode; gain: GainNode } | null)[] = [];
  private out: GainNode;

  constructor(
    private ctx: AudioContext,
    private buffer: AudioBuffer,
    private slices: Slice[],
    public voiceCount: number,
    private onHit: (h: Hit) => void,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.8;
    this.out.connect(ctx.destination);
    this.newBeat();
  }

  private pickSlices(n: number) {
    // urn: shuffle all slice indexes, deal without repeats
    const urn = this.slices.map((_, i) => i);
    for (let i = urn.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [urn[i], urn[j]] = [urn[j], urn[i]];
    }
    return Array.from({ length: n }, (_, i) => urn[i % Math.max(1, urn.length)]);
  }

  private randomPattern(voice: number): boolean[] {
    if (voice === 0 || Math.random() < 0.25) {
      const p = PRESETS[Math.floor(Math.random() * PRESETS.length)];
      return [...p].map((c) => c === '1');
    }
    const density = 0.12 + Math.random() * 0.3;
    return Array.from({ length: STEPS }, () => Math.random() < density);
  }

  newBeat() {
    const picks = this.pickSlices(this.voiceCount);
    this.voices = picks.map((slice, v) => ({
      slice,
      pattern: this.randomPattern(v),
      pan: v === 0 ? 0 : Math.random() * 1.4 - 0.7,
      human: 0.45 + Math.random() * 0.55,
    }));
  }

  /** One random change: a new pattern or a new slice for one voice. */
  evolve() {
    if (!this.voices.length) return;
    const v = this.voices[Math.floor(Math.random() * this.voices.length)];
    if (Math.random() < 0.5) {
      v.pattern = this.randomPattern(1);
    } else {
      const used = new Set(this.voices.map((x) => x.slice));
      const free = this.slices.map((_, i) => i).filter((i) => !used.has(i));
      if (free.length) v.slice = free[Math.floor(Math.random() * free.length)];
    }
  }

  /** Swap in a new slice list (e.g. after re-slicing), keeping patterns. */
  setSlices(slices: Slice[]) {
    this.slices = slices;
    const n = slices.length;
    if (!n) { this.stop(); return; }
    const used = new Set<number>();
    for (const v of this.voices) {
      if (v.slice >= n || used.has(v.slice)) {
        const free = slices.map((_, i) => i).filter((i) => !used.has(i));
        v.slice = free.length ? free[Math.floor(Math.random() * free.length)] : v.slice % n;
      }
      used.add(v.slice);
    }
  }

  setVoiceCount(n: number) {
    this.voiceCount = n;
    while (this.voices.length > n) this.voices.pop();
    if (this.voices.length < n) {
      const used = new Set(this.voices.map((x) => x.slice));
      const free = this.slices.map((_, i) => i).filter((i) => !used.has(i));
      while (this.voices.length < n) {
        const v = this.voices.length;
        const slice = free.length ? free.splice(Math.floor(Math.random() * free.length), 1)[0] : v % this.slices.length;
        this.voices.push({ slice, pattern: this.randomPattern(v), pan: Math.random() * 1.4 - 0.7, human: 0.75 });
      }
    }
  }

  start() {
    if (this.playing || !this.slices.length) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
  }

  dispose() {
    this.stop();
    setTimeout(() => this.out.disconnect(), 500);
  }

  private schedule() {
    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      this.voices.forEach((v, i) => {
        // humanize: brownian walk, 0.45–1
        v.human = Math.min(1, Math.max(0.45, v.human + (Math.random() - 0.5) * 0.11));
        if (v.pattern[this.step]) this.play(i, v, this.nextTime);
      });
      this.nextTime += stepDur;
      this.step = (this.step + 1) % STEPS;
    }
  }

  private play(i: number, v: Voice, t: number) {
    const s = this.slices[v.slice];
    if (!s) return;
    // choke the previous hit on this voice
    const prev = this.last[i];
    if (prev) {
      prev.gain.gain.setTargetAtTime(0, t, 0.004);
      prev.src.stop(t + 0.05);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    const gain = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner();
    pan.pan.value = v.pan;
    const dur = s.end - s.start;
    const level = 0.87 * v.human;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.003);
    gain.gain.setValueAtTime(level, t + Math.max(0.004, dur - 0.02));
    gain.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(gain).connect(pan).connect(this.out);
    src.start(t, s.start, dur);
    this.last[i] = { src, gain };
    const delay = Math.max(0, (t - this.ctx.currentTime) * 1000);
    setTimeout(() => this.onHit({ voice: i, slice: v.slice, step: this.stepAt(t), time: t }), delay);
  }

  private stepAt(t: number) {
    const stepDur = 60 / this.bpm / 4;
    const back = Math.round((this.nextTime - t) / stepDur);
    return (((this.step - back) % STEPS) + STEPS) % STEPS;
  }
}

/** Play one slice now, with short fades. */
export function playSlice(ctx: AudioContext, buffer: AudioBuffer, s: Slice, when = ctx.currentTime) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  const dur = s.end - s.start;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.9, when + 0.003);
  g.gain.setValueAtTime(0.9, when + Math.max(0.004, dur - 0.02));
  g.gain.linearRampToValueAtTime(0, when + dur);
  src.connect(g).connect(ctx.destination);
  src.start(when, s.start, dur);
  return src;
}
