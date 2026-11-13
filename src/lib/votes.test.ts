import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasVoted, markVoted } from './votes';

describe('votes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('remembers likes and flags per BeatVox, once each', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    expect(hasVoted('like', 5)).toBe(false);
    markVoted('like', 5);
    markVoted('like', 5);
    markVoted('flag', 6);
    expect(hasVoted('like', 5)).toBe(true);
    expect(hasVoted('flag', 5)).toBe(false);
    expect(hasVoted('flag', 6)).toBe(true);
    expect(JSON.parse(store.get('beatvox.votes')!)).toEqual({ like: [5], flag: [6] });
  });

  it('works without storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(hasVoted('like', 1)).toBe(false);
    markVoted('like', 1);
  });
});
