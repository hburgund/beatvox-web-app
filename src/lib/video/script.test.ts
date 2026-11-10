import { describe, it, expect } from 'vitest';
import { buildScript, stepOf, END_CARD } from './script';
import { LEAD } from '../audio/render';
import type { Tape } from '../audio/engine';

// a stand-in for an AudioBuffer: 1 s of silence, then a loud bit
function audio(seconds: number, sr = 1000) {
  const data = new Float32Array(seconds * sr);
  for (let i = sr; i < sr * 1.2; i++) data[i] = 0.5;
  return { sampleRate: sr, length: data.length, numberOfChannels: 1, getChannelData: () => data, duration: seconds } as unknown as AudioBuffer;
}

describe('stepOf', () => {
  it('puts swung and late hits on their own step, not the next', () => {
    expect(stepOf(10 + 0.125 * 3, 10, 0.125)).toBe(3);
    expect(stepOf(10 + 0.125 * 3.6, 10, 0.125)).toBe(3);
    expect(stepOf(10 + 0.125 * 3.7, 10, 0.125)).toBe(4);
  });
});

describe('buildScript', () => {
  const hit = (t: number, voice: number, offset: number) => ({ k: 'hit' as const, t, voice, offset, len: 0.1, rate: 1, level: 1, a: 0.01, h: 0.05 });
  const tape = { start: 50, end: 66, loops: 8, bpm: 120, head: [], cmds: [hit(50, 0, 0.42), hit(50.25, 0, 0.42), hit(50 + 16 * 0.125, 2, 1.05)] } as unknown as Tape;
  const sc = buildScript(
    {
      fullAudio: audio(30),
      remixAt: 3,
      tape,
      voiceSpan: { start: 0.3, end: 2.3 },
      slices: [
        { start: 0.4, end: 0.6, role: 'kick' },
        { start: 1.0, end: 1.2, role: 'snare' },
      ],
    },
    'Morning Kettle',
  );

  it('lays out the voice, the beat and the end card on the soundtrack', () => {
    expect(sc.voiceStart).toBe(LEAD);
    expect(sc.voiceEnd).toBeCloseTo(LEAD + 2);
    expect(sc.step).toBe(0.125);
    expect(sc.steps).toBe(128);
    expect(sc.end).toBeCloseTo(3 + 16);
    expect(sc.length).toBeCloseTo(3 + 16 + END_CARD);
  });

  it('knows each hit by step and row, and when each row’s slice is heard', () => {
    expect(sc.hits[0][0]).toBe(true);
    expect(sc.hits[2][0]).toBe(true);
    expect(sc.hits[16][2]).toBe(true);
    expect(sc.hits[1][0]).toBe(false);
    expect(sc.rows[0]).toEqual({ sound: 'kick', heardAt: LEAD + 0.4 - 0.3 });
    expect(sc.rows[2].sound).toBe('snare');
    expect(sc.rows[1].heardAt).toBeNull();
  });

  it('measures the voice’s loudness, loudest = 1', () => {
    expect(sc.env[50]).toBe(0);
    expect(sc.env[105]).toBeCloseTo(1);
  });
});

describe('pickSprout', () => {
  it('picks each sprout, never past the end', async () => {
    const { pickSprout, SPROUTS } = await import('./draw');
    expect(pickSprout(() => 0)).toBe(SPROUTS[0]);
    expect(pickSprout(() => 0.999)).toBe(SPROUTS[SPROUTS.length - 1]);
    expect(pickSprout(() => 1)).toBe(SPROUTS[0]);
  });
});
