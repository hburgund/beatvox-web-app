import { describe, expect, it } from 'vitest';
import { cutCurve } from './voiceBank';
import { shift, voiceSpan } from './render';
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
    expect(shift({ k: 'width', t: 21.5, value: 1 }, tape, 5).t).toBeCloseTo(6.5);
    // anything sent just before the downbeat lands on it
    expect(shift({ k: 'width', t: 19.9, value: 1 }, tape, 5).t).toBe(5);
  });

  it('trims the voice to its slices', () => {
    expect(voiceSpan([{ start: 1, end: 1.5 }, { start: 3, end: 3.2 }], 10)).toEqual({ start: 0.92, end: 3.45 });
    expect(voiceSpan([], 4)).toEqual({ start: 0, end: 4 });
  });
});
