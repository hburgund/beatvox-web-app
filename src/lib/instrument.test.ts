import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId, refersTo, type Instrument } from './instrument';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newId', () => {
  afterEach(() => vi.restoreAllMocks());

  it('makes v4 UUIDs', () => {
    expect(newId()).toMatch(UUID_V4);
  });

  it('makes proper UUIDs without randomUUID (plain-HTTP pages)', () => {
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('not a secure context');
    });
    const ids = new Set(Array.from({ length: 1000 }, newId));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});

describe('refersTo', () => {
  const inst = (assetId?: number) => ({ id: 'abc', source: { assetId, duration: 1, sampleRate: 44100 } }) as Instrument;

  it('matches on id', () => {
    expect(refersTo({ id: 'abc' }, inst())).toBe(true);
    expect(refersTo({ id: 'xyz' }, inst())).toBe(false);
    expect(refersTo(undefined, inst())).toBe(false);
    expect(refersTo({ id: 'abc' }, null)).toBe(false);
  });

  it('also needs the voice asset id to match when both have one', () => {
    expect(refersTo({ id: 'abc', assetId: 42 }, inst(42))).toBe(true);
    expect(refersTo({ id: 'abc', assetId: '42' }, inst(42))).toBe(true);
    // a recipe that copied the id but points at another voice
    expect(refersTo({ id: 'abc', assetId: 99 }, inst(42))).toBe(false);
    // not uploaded yet on one side: the id decides
    expect(refersTo({ id: 'abc' }, inst(42))).toBe(true);
    expect(refersTo({ id: 'abc', assetId: 42 }, inst())).toBe(true);
  });
});
