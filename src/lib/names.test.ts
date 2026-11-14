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

  /** a rand() that returns these in turn, then 0 */
  const seq = (...xs: number[]) => {
    let i = 0;
    return () => xs[i++] ?? 0;
  };
  const A = ADJECTIVES[0];
  const N = NOUNS[0];
  const plain = (name: string) => name.replace(/["!?]/g, '');

  it('gives an adjective and a noun', () => {
    for (let k = 0; k < 200; k++) {
      const name = plain(randomName());
      expect(ADJECTIVES.some((a) => name.startsWith(a + ' ') && NOUNS.includes(name.slice(a.length + 1)))).toBe(true);
    }
  });

  it('adds a flourish a quarter of the time', () => {
    // adjective, noun, then the flourish roll
    expect(randomName('', seq(0, 0, 0.5))).toBe(`${A} ${N}`);
    expect(randomName('', seq(0, 0, 0.1, 0))).toBe(`${A} ${N}!`);
    expect(randomName('', seq(0, 0, 0.1, 0.3))).toBe(`${A} ${N}?`);
    expect(randomName('', seq(0, 0, 0.1, 0.6))).toBe(`"${A}" ${N}`);
    expect(randomName('', seq(0, 0, 0.1, 0.9))).toBe(`${A} "${N}"`);
    let fancy = 0;
    for (let k = 0; k < 4000; k++) if (/["!?]/.test(randomName())) fancy++;
    expect(fancy / 4000).toBeGreaterThan(0.2);
    expect(fancy / 4000).toBeLessThan(0.3);
  });

  it('never repeats the one showing', () => {
    expect(randomName(`${A} ${N}`, seq(0, 0, 0.5, 0.5, 0.5, 0.9))).not.toBe(`${A} ${N}`);
  });

  it('skips a word paired with itself', () => {
    const r = seq(ADJECTIVES.indexOf('Remixed') / ADJECTIVES.length, NOUNS.indexOf('Remix') / NOUNS.length, 0, 0, 0.5);
    expect(randomName('', r)).toBe(`${A} ${N}`);
  });
});
