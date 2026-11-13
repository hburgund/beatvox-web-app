import { describe, it, expect } from 'vitest';
import { chooseMix, matchRecipes, ringRows } from './shared';
import type { Recipe } from './recipe';

const r = (name: string, mixAssetId?: number) => ({ name, mixAssetId });

describe('matchRecipes', () => {
  it('uses the mix a recipe names', () => {
    const m = matchRecipes(
      [
        { id: 1, createdAt: '2026-11-09T10:00:00Z' },
        { id: 2, createdAt: '2026-11-09T11:00:00Z' },
      ],
      [
        { createdAt: '2026-11-09T10:00:01Z', recipe: r('b', 2) },
        { createdAt: '2026-11-09T11:00:01Z', recipe: r('a', 1) },
      ],
    );
    expect(m.get(1)?.name).toBe('a');
    expect(m.get(2)?.name).toBe('b');
  });

  it('matches older recipes by time: the first one after each mix', () => {
    const m = matchRecipes(
      [
        { id: 7, createdAt: '2026-11-09T11:00:00Z' },
        { id: 5, createdAt: '2026-11-09T10:00:00Z' },
      ],
      [
        { createdAt: '2026-11-09T11:00:02Z', recipe: r('second') },
        { createdAt: '2026-11-09T10:00:02Z', recipe: r('first') },
      ],
    );
    expect(m.get(5)?.name).toBe('first');
    expect(m.get(7)?.name).toBe('second');
  });

  it('leaves a mix without a recipe when none was sent for it', () => {
    const m = matchRecipes(
      [
        { id: 1, createdAt: '2026-11-09T10:00:00Z' },
        { id: 2, createdAt: '2026-11-09T11:00:00Z' },
      ],
      [{ createdAt: '2026-11-09T11:00:02Z', recipe: r('late') }],
    );
    expect(m.has(1)).toBe(false);
    expect(m.get(2)?.name).toBe('late');
  });
});

describe('ringRows', () => {
  it('gives 8 rows with hits, playing state and sound', () => {
    const recipe = {
      voices: [
        { pattern: 'x...x...x...x...', sliceRole: 'kick' },
        { pattern: '....x.......x...', on: false, role: 'snare' },
      ],
    } as unknown as Recipe;
    const rows = ringRows(recipe);
    expect(rows).toHaveLength(8);
    expect(rows[0].hits.filter(Boolean)).toHaveLength(4);
    expect(rows[0].sound).toBe('kick');
    expect(rows[1].on).toBe(false);
    expect(rows[1].sound).toBe('snare');
    expect(rows[7].hits.some(Boolean)).toBe(false);
  });
});

describe('share links', () => {
  it('build and read /b/<id>', async () => {
    const { beatvoxShareUrl, sharePageId } = await import('./roundware');
    expect(beatvoxShareUrl(32670, 'https://beatvox.example')).toBe('https://beatvox.example/b/32670');
    expect(sharePageId('/b/32670')).toBe(32670);
    expect(sharePageId('/b/32670/')).toBe(32670);
    expect(sharePageId('/')).toBeNull();
    expect(sharePageId('/b/abc')).toBeNull();
  });
});

describe('chooseMix', () => {
  const family = [{ id: 11 }, { id: 21 }];
  it('opens the beat a link names', () => expect(chooseMix(family, 21, 10)?.id).toBe(21));
  it('opens the first beat for a link to the vox', () => expect(chooseMix(family, 10, 10)?.id).toBe(11));
  it("opens nothing for a beat that isn't live, not a sibling", () => expect(chooseMix(family, 31, 10)).toBeNull());
  it('opens nothing when the vox has no live beats', () => expect(chooseMix([], 10, 10)).toBeNull());
});
