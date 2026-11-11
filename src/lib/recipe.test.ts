import { describe, expect, it } from 'vitest';
import { formatPattern, parsePattern, parseRecipe, validateRecipe } from './recipe';
import { STYLES, STYLE_ERRORS, styleBeats } from './styles';

describe('recipe patterns', () => {
  it('reads drum-machine notation', () => {
    const p = parsePattern('X...x...o...x...');
    expect(p.hits.filter(Boolean)).toHaveLength(4);
    expect(p.accent[0]).toBeGreaterThan(1);
    expect(p.accent[8]).toBeLessThan(1);
  });

  it('accepts v1.93 binary and ignores spaces and bars', () => {
    expect(parsePattern('1001 0110 0001 0111').hits).toEqual(parsePattern('1001|0110|0001|0111').hits);
    expect(parsePattern('1001011000010111').hits.filter(Boolean)).toHaveLength(8);
  });

  it('round-trips through formatPattern', () => {
    const s = 'X.o.x...x.X..o.x';
    const p = parsePattern(s);
    expect(formatPattern(p.hits, p.accent)).toBe(s);
  });

  it('rejects bad patterns', () => {
    expect(() => parsePattern('x...')).toThrow(/16/);
    expect(() => parsePattern('x...y...x...x...')).toThrow(/unknown/);
  });
});

describe('recipes', () => {
  it('loads every file in src/styles', () => {
    expect(STYLE_ERRORS).toEqual([]);
    expect(STYLES.map((s) => s.name)).toEqual([
      'BeatVox', 'House', 'Boom Bap', 'Rock', 'Breakbeat', 'Dembow', 'Trap', 'Drum & Bass',
    ]);
  });

  it('every built-in beat is valid and survives JSON', () => {
    for (const st of STYLES)
      for (const b of st.beats) {
        expect(() => validateRecipe(b)).not.toThrow();
        expect(parseRecipe(JSON.stringify(b))).toEqual(b);
      }
  });

  it('every style has about ten beats, each with its own name', () => {
    for (const st of STYLES) {
      expect(st.beats.length, st.name).toBeGreaterThanOrEqual(8);
      expect(new Set(st.beats.map((b) => b.name)).size, st.name).toBe(st.beats.length);
    }
  });

  it("a style's beats take the file's settings unless they change them", () => {
    const f = {
      format: 'beatvox-recipe', version: 1, name: 'S', kind: 'style', bpm: 120, swing: 0.1,
      beats: [
        { name: 'A', voices: [{ pattern: 'x'.repeat(16) }] },
        { name: 'B', bpm: 90, voices: [{ pattern: 'x'.repeat(16) }] },
      ],
    };
    const [a, b] = styleBeats(f);
    expect([a.name, a.bpm, a.swing, a.kind]).toEqual(['A', 120, 0.1, 'style']);
    expect([b.name, b.bpm, b.swing]).toEqual(['B', 90, 0.1]);
    expect('beats' in a).toBe(false);
    expect(() => styleBeats({ ...f, beats: [{ name: 'C', voices: [{ pattern: 'x...' }] }] })).toThrow(/beat "C".*16/);
    expect(() => styleBeats({ ...f, beats: [] })).toThrow(/at least one/);
    expect(() => styleBeats({ ...f, kind: 'beat' })).toThrow(/expected "style"/);
  });

  it('rejects things that are not recipes', () => {
    expect(() => parseRecipe('{"name":"x"}')).toThrow(/format/);
    expect(() =>
      validateRecipe({ format: 'beatvox-recipe', version: 1, name: 'x', kind: 'style', voices: Array(9).fill({ pattern: 'x'.repeat(16) }) }),
    ).toThrow(/voices/);
  });

  it('checks level and humanize, and says velocity is now level', () => {
    const r = (voice: object, extra: object = {}) => ({ format: 'beatvox-recipe', version: 1, name: 'x', kind: 'style', voices: [{ pattern: 'x'.repeat(16), ...voice }], ...extra });
    expect(() => validateRecipe(r({ level: 0.7 }, { humanize: 0.5 }))).not.toThrow();
    expect(() => validateRecipe(r({ level: 1.5 }))).toThrow(/level/);
    expect(() => validateRecipe(r({}, { humanize: 2 }))).toThrow(/humanize/);
    expect(() => validateRecipe(r({ velocity: 90 }))).toThrow(/now "level"/);
  });
});
