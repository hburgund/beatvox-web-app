import { describe, expect, it } from 'vitest';
import { barsIn, heardFromRecipe, tapeFromRecipe } from './rebuild';
import { buildScript } from './script';
import { encodePlayed } from '../played';
import type { Instrument } from '../instrument';
import type { Recipe } from '../recipe';

const instrument = {
  slices: [
    { start: 0.4, end: 0.6, role: 'kick' },
    { start: 1.0, end: 1.2, role: 'snare' },
  ],
} as unknown as Instrument;

const base: Recipe = {
  format: 'beatvox-recipe',
  version: 1,
  name: 'Morning Kettle',
  kind: 'beat',
  bpm: 120,
  voices: [
    { pattern: 'x...x...x...x...', slice: 0 },
    { pattern: '....x.......x...', slice: 1 },
    { pattern: 'xxxxxxxxxxxxxxxx', slice: 1, on: false },
  ],
};

describe('rebuilding a video from what was sent', () => {
  it('counts the bars in the loop', () => {
    expect(barsIn(16, 120)).toBe(8);
    expect(barsIn(16.02, 120)).toBe(8);
  });

  it('repeats the patterns for a beat saved without what it played', () => {
    const hits = heardFromRecipe(base, 2);
    expect(hits).toHaveLength(32);
    expect(hits[0][0]).toBe(true);
    expect(hits[16][0]).toBe(true);
    expect(hits[4][1]).toBe(true);
    expect(hits.some((s) => s[2])).toBe(false);
  });

  it('plays each bar as heard, when it was saved', () => {
    const heard = Array.from({ length: 32 }, () => Array(8).fill(false));
    heard[3][0] = true; // bar 1
    heard[16 + 5][1] = true; // bar 2 only
    const hits = heardFromRecipe({ ...base, played: encodePlayed(heard) }, 2);
    expect(hits[3][0]).toBe(true);
    expect(hits[0][0]).toBe(false);
    expect(hits[21][1]).toBe(true);
    expect(hits[5][1]).toBe(false);
  });

  it('gives the video each row’s slice and every hit on its step', () => {
    const tape = tapeFromRecipe(base, instrument, 8);
    expect(tape.end).toBeCloseTo(16);
    const audio = { sampleRate: 1000, length: 30000, numberOfChannels: 1, duration: 30, getChannelData: () => new Float32Array(30000) } as unknown as AudioBuffer;
    const sc = buildScript({ fullAudio: audio, remixAt: 3, tape, voiceSpan: { start: 0.3, end: 1.5 }, slices: instrument.slices }, 'x');
    expect(sc.steps).toBe(128);
    expect(sc.hits[0][0]).toBe(true);
    expect(sc.hits[4][1]).toBe(true);
    expect(sc.hits[127 - 3][0]).toBe(true);
    expect(sc.rows[0].sound).toBe('kick');
    expect(sc.rows[1].sound).toBe('snare');
    expect(sc.rows[2].heardAt).toBeNull();
  });

});
