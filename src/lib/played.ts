// The beat as it was heard, bar by bar: which steps each row played in
// every bar of a saved BeatVox. A beat that evolves (or that someone
// changed while it was being saved) changes from bar to bar; the recipe's
// patterns are only how it started. Saved with a beat sent to the map
// (Recipe.played), so the ring there can change with the music, as it does
// in the share videos.
//
// Each bar is one string: 8 rows of 4 hex digits, 16 steps a row, the
// first step the highest bit. "8888…" is four on the floor in row 1.
// Written up, with a worked example, in docs/RECIPE.md.
import type { Tape } from './audio/engine';

export const ROWS = 8;
export const STEPS = 16;

/** The step a taped hit belongs to. Swing and humanize land hits a little late, never early. */
export function stepOf(t: number, start: number, step: number) {
  return Math.floor((t - start) / step + 0.35);
}

/** Every hit on the tape: hits[step][row], for all its bars. */
export function heardHits(tape: Tape): boolean[][] {
  const step = 60 / tape.bpm / 4;
  const steps = tape.loops * STEPS;
  const hits = Array.from({ length: steps }, () => Array<boolean>(ROWS).fill(false));
  for (const c of tape.cmds) {
    if (c.k !== 'hit' || c.voice >= ROWS) continue;
    const s = stepOf(c.t, tape.start, step);
    if (s >= 0 && s < steps) hits[s][c.voice] = true;
  }
  return hits;
}

/** hits[step][row] as one string per bar. */
export function encodePlayed(hits: boolean[][]): string[] {
  const bars: string[] = [];
  for (let b = 0; b * STEPS < hits.length; b++) {
    let s = '';
    for (let row = 0; row < ROWS; row++) {
      let bits = 0;
      for (let k = 0; k < STEPS; k++) if (hits[b * STEPS + k]?.[row]) bits |= 1 << (STEPS - 1 - k);
      s += bits.toString(16).padStart(4, '0');
    }
    bars.push(s);
  }
  return bars;
}

/** One bar's string as rows[row][step]. */
export function decodeBar(bar: string): boolean[][] {
  return Array.from({ length: ROWS }, (_, row) => {
    const bits = parseInt(bar.slice(row * 4, row * 4 + 4), 16) || 0;
    return Array.from({ length: STEPS }, (_, k) => (bits & (1 << (STEPS - 1 - k))) !== 0);
  });
}

export const PLAYED_BAR = /^[0-9a-f]{32}$/;
