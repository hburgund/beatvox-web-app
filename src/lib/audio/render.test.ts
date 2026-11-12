import { describe, expect, it } from 'vitest';
import { cutCurve } from './voiceBank';
import { foldLoop, shift, voiceSpan } from './render';
import type { Tape } from './engine';

describe('cutCurve', () => {
  it('keeps the rest of a running pan ramp', () => {
    const curve = new Float32Array(32).map((_, k) => -1 + (2 * k) / 31); // -1 → 1
    const cut = cutCurve({ k: 'pan', t: 10, voice: 3, dur: 4, curve }, 11);
    expect(cut.t).toBe(11);
    expect(cut.dur).toBeCloseTo(3);
    expect(cut.curve[0]).toBeCloseTo(-0.5, 5);
    expect(cut.curve[cut.curve.length - 1]).toBeCloseTo(1, 5);
    expect(cut.voice).toBe(3);
  });
});

describe('render layout', () => {
  it('moves taped commands to where the remix starts', () => {
    const tape = { start: 20 } as Tape;
    expect(shift({ k: 'tempo', t: 21.5, bpm: 90 }, tape, 5).t).toBeCloseTo(6.5);
    // anything sent just before the downbeat lands on it
    expect(shift({ k: 'tempo', t: 19.9, bpm: 90 }, tape, 5).t).toBe(5);
  });

  it('trims the voice to its slices', () => {
    expect(voiceSpan([{ start: 1, end: 1.5 }, { start: 3, end: 3.2 }], 10)).toEqual({ start: 0.92, end: 3.45 });
    expect(voiceSpan([], 4)).toEqual({ start: 0, end: 4 });
  });
});

// just enough AudioBuffer for Node
class FakeBuffer {
  length: number;
  numberOfChannels: number;
  sampleRate: number;
  private data: Float32Array[];
  constructor(o: { length: number; numberOfChannels: number; sampleRate: number }) {
    this.length = o.length;
    this.numberOfChannels = o.numberOfChannels;
    this.sampleRate = o.sampleRate;
    this.data = Array.from({ length: o.numberOfChannels }, () => new Float32Array(o.length));
  }
  getChannelData(c: number) {
    return this.data[c];
  }
}

describe('foldLoop', () => {
  it('keeps whole loops and wraps the tail onto the start', () => {
    (globalThis as { AudioBuffer?: unknown }).AudioBuffer = FakeBuffer;
    const src = new FakeBuffer({ length: 30, numberOfChannels: 1, sampleRate: 10 }) as unknown as AudioBuffer;
    const d = src.getChannelData(0);
    d[2] = 9; // before the loop: dropped (that's the voice part)
    d[5] = 0.5; // loop start
    d[14] = 0.25; // last sample of the loop
    d[15] = 0.5; // tail: wraps to the loop's first sample
    d[26] = 0.1; // tail past one whole loop: wraps again, to sample 1
    const out = foldLoop(src, 5, 10, 1);
    const o = out.getChannelData(0);
    expect(out.length).toBe(10);
    // 0.5 + 0.5 at the start, normalized to peak 1
    expect(o[0]).toBeCloseTo(1);
    expect(o[9]).toBeCloseTo(0.25);
    expect(o[1]).toBeCloseTo(0.1);
    expect(Math.max(...o)).toBeCloseTo(1);
  });
});
