import { describe, expect, it } from 'vitest';
import { formatPattern, parsePattern, parseRecipe, validateRecipe } from './recipe';
import { STYLES, STYLE_ERRORS } from './styles';

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
      'v1.93 Groove', 'House', 'Boom Bap', 'Rock', 'Breakbeat', 'Dembow', 'Trap', 'Drum & Bass',
    ]);
  });

  it('every built-in style is valid and survives JSON', () => {
    for (const s of STYLES) {
      expect(() => validateRecipe(s)).not.toThrow();
      expect(parseRecipe(JSON.stringify(s))).toEqual(s);
    }
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
