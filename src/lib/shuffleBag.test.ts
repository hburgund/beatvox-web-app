import { describe, it, expect } from 'vitest';
import { ShuffleBag } from './shuffleBag';
import { Rng } from './audio/rng';

describe('ShuffleBag', () => {
  const pool = [1, 2, 3, 4, 5, 6];

  it('plays every mix once before any repeats, round after round', () => {
    const rng = new Rng(7);
    const bag = new ShuffleBag(() => rng.next());
    let current: number | null = null;
    for (let round = 0; round < 5; round++) {
      const seen = new Set<number>();
      for (let i = 0; i < pool.length; i++) {
        current = bag.next(pool, current);
        expect(seen.has(current!)).toBe(false);
        seen.add(current!);
      }
      expect(seen.size).toBe(pool.length);
    }
  });

  it('never plays the same mix twice in a row, even across rounds', () => {
    const rng = new Rng(3);
    const bag = new ShuffleBag(() => rng.next());
    let current: number | null = null;
    for (let i = 0; i < 200; i++) {
      const n = bag.next(pool, current);
      expect(n).not.toBe(current);
      current = n;
    }
  });

  it('copes with a pool that changes, one mix, or none', () => {
    const bag = new ShuffleBag(() => 0);
    expect(bag.next([], null)).toBeNull();
    expect(bag.next([9], 9)).toBe(9);
    bag.mark(1);
    expect(bag.next([1, 2], 2)).toBe(1); // 2 is playing; 1 was played, so a new round
    expect(bag.next([1, 2, 3], 1)).toBe(2);
  });
});
