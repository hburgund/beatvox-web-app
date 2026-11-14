import { describe, expect, it } from 'vitest';
import { ADJECTIVES, NOUNS, randomName } from './names';

describe('random names', () => {
  it('has about 200 words in each list, none twice', () => {
    for (const list of [ADJECTIVES, NOUNS]) {
      expect(list.length).toBeGreaterThanOrEqual(190);
      const dupes = list.filter((w, i) => list.indexOf(w) !== i);
      expect(dupes).toEqual([]);
    }
  });

  it('words are capitalised and tidy', () => {
    for (const w of [...ADJECTIVES, ...NOUNS]) {
      expect(w).toBe(w.trim());
      expect(w).toMatch(/^[A-Z][A-Za-z]*([ -][A-Za-z]+)*$/);
    }
  });

  it('fits the name field', () => {
    const longest = Math.max(...ADJECTIVES.map((a) => a.length)) + 1 + Math.max(...NOUNS.map((n) => n.length));
    expect(longest).toBeLessThanOrEqual(60);
  });

  it('gives an adjective and a noun', () => {
    const name = randomName();
    expect(ADJECTIVES.some((a) => name.startsWith(a + ' ') && NOUNS.includes(name.slice(a.length + 1)))).toBe(true);
  });

  it('never repeats the one showing', () => {
    const fixed = () => 0; // always the first of each list
    const first = `${ADJECTIVES[0]} ${NOUNS[0]}`;
    expect(randomName('', fixed)).toBe(first);
    let n = 0;
    const alternating = () => (n++ < 2 ? 0 : 0.5);
    expect(randomName(first, alternating)).not.toBe(first);
  });

  it('skips a word paired with itself', () => {
    const seq = [ADJECTIVES.indexOf('Remixed'), NOUNS.indexOf('Remix'), 0, 1];
    let i = 0;
    const rand = () => (seq[i] ?? 0) / (i++ < 1 ? ADJECTIVES.length : NOUNS.length) + 1e-9;
    expect(randomName('', rand)).not.toBe('Remixed Remix');
  });
});
