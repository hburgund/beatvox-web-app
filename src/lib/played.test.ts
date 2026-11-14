import { describe, expect, it } from 'vitest';
import type { Tape } from './audio/engine';
import { decodeBar, encodePlayed, heardHits, PLAYED_BAR } from './played';
import { ringRows } from './shared';
import { RECIPE_FORMAT, RECIPE_VERSION, validateRecipe, type Recipe } from './recipe';

const hit = (t: number, voice: number) => ({ k: 'hit' as const, t, voice, offset: 0, len: 0.1, rate: 1, level: 1, a: 0, h: 0 });

describe('the beat as heard', () => {
  // 120 bpm: a sixteenth is 0.125 s; capture starts at 10 s
  const tape = {
    start: 10,
    end: 14,
    loops: 2,
    bpm: 120,
    head: [],
    cmds: [
      hit(10, 0), // bar 1, step 1, row 1
      hit(10 + 0.125 * 4 + 0.02, 0), // a little late: still step 5
      hit(10 + 0.125 * 16, 2), // bar 2, step 1, row 3
      hit(10 + 0.125 * 31, 7), // bar 2, last step, row 8
      hit(9, 1), // before the capture: not counted
      hit(10 + 0.125 * 40, 1), // after it: not counted
    ],
    recipe: {} as Recipe,
  } as Tape;

  it('takes every hit from the tape, by step and row', () => {
    const hits = heardHits(tape);
    expect(hits.length).toBe(32);
    expect(hits[0][0] && hits[4][0] && hits[16][2] && hits[31][7]).toBe(true);
    expect(hits.flat().filter(Boolean).length).toBe(4);
  });

  it('writes each bar as 32 hex digits and reads it back', () => {
    const bars = encodePlayed(heardHits(tape));
    expect(bars).toEqual(['8800' + '0'.repeat(28), '0'.repeat(8) + '8000' + '0'.repeat(16) + '0001']);
    for (const b of bars) expect(b).toMatch(PLAYED_BAR);
    const bar2 = decodeBar(bars[1]);
    expect(bar2[2][0]).toBe(true);
    expect(bar2[7][15]).toBe(true);
    expect(bar2.flat().filter(Boolean).length).toBe(2);
  });

  const recipe: Recipe = {
    format: RECIPE_FORMAT,
    version: RECIPE_VERSION,
    name: 'Test',
    kind: 'beat',
    voices: [{ pattern: 'x...x...x...x...', sliceRole: 'kick' }, { pattern: '................', on: false }],
    played: encodePlayed(heardHits(tape)),
  };

  it('the ring shows the bar playing, and how it started when stopped', () => {
    expect(ringRows(recipe)[0].hits.filter(Boolean).length).toBe(4);
    expect(ringRows(recipe, 0)[0].hits.filter(Boolean).length).toBe(2);
    expect(ringRows(recipe, 0)[0].sound).toBe('kick');
    const bar2 = ringRows(recipe, 1);
    expect(bar2[0].hits.some(Boolean)).toBe(false);
    expect(bar2[2]).toMatchObject({ on: true });
    expect(bar2[1].on).toBe(false);
    // round again
    expect(ringRows(recipe, 2)).toEqual(ringRows(recipe, 0));
    // a beat saved before this: as it started, whatever the bar
    expect(ringRows({ ...recipe, played: undefined }, 1)).toEqual(ringRows(recipe));
  });

  it('a recipe checks what it played', () => {
    expect(() => validateRecipe(recipe)).not.toThrow();
    expect(() => validateRecipe({ ...recipe, played: ['xyz'] })).toThrow(/played/);
    expect(() => validateRecipe({ ...recipe, played: 'nope' })).toThrow(/played/);
  });
});
