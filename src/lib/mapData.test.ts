import { describe, it, expect } from 'vitest';
import { buildFilters, globeCenter, passes, wrapLng, type MapMix } from './mapData';

const tags = [
  { id: 1124, value: 'beatvox-source', description: 'BeatVox Source Audio' },
  { id: 1125, value: 'revox-mix', description: 'ReVox Mix Audio' },
  { id: 1128, value: 'beatvox-mix', description: 'BeatVox Mix Audio' },
  { id: 1129, value: 'revox-allowed', description: 'reVox allowed' },
];
const listen = {
  ui_mode: 'listen',
  name: 'Type',
  header_text: 'Filter by topic',
  active: true,
  ui_items: [
    { tag_id: 1124, active: true, sort_index: 0 },
    { tag_id: 1125, active: true, sort_index: 1 },
  ],
};
const mix = (tags: number[]): MapMix => ({ id: 1, voxId: 9, title: 't', file: 'f', latitude: 0, longitude: 0, createdAt: '', revox: false, tags });

describe('buildFilters', () => {
  it("uses the listen group, drops BeatVox's internal tags, and adds originals and reVox permission", () => {
    const f = buildFilters(tags, [listen]);
    expect(f.map((g) => g.name)).toEqual(['KIND', 'REVOX']);
    expect(f[0].items.map((i) => i.tagId)).toEqual([1128, 1125]);
    expect(f[0].items[0].label).toBe('Original BeatVoxes');
    expect(f[1].items[0].label).toBe('Can be reVoxed');
  });

  it('leaves out reVox permission while the live server has no such tag', () => {
    const f = buildFilters(tags.filter((t) => t.id !== 1129), [listen]);
    expect(f.map((g) => g.name)).toEqual(['KIND']);
  });

  it('still offers the two kinds with no listen group', () => {
    expect(buildFilters(tags, [])[0].items.map((i) => i.tagId)).toEqual([1128, 1125]);
  });
});

describe('passes', () => {
  const groups = buildFilters(tags, [listen]);
  it('shows everything with nothing ticked', () => {
    expect(passes(mix([1128]), groups, new Set())).toBe(true);
  });
  it('matches any ticked tag within a group, and every group with a tick', () => {
    expect(passes(mix([1125]), groups, new Set([1128, 1125]))).toBe(true);
    expect(passes(mix([1125]), groups, new Set([1128]))).toBe(false);
    expect(passes(mix([1128, 1129]), groups, new Set([1128, 1129]))).toBe(true);
    expect(passes(mix([1128]), groups, new Set([1128, 1129]))).toBe(false);
  });
});

describe('wrapLng and globeCenter', () => {
  it('brings a longitude from a repeated copy of the world back into range', () => {
    expect(wrapLng(-321.7)).toBeCloseTo(38.3, 5);
    expect(wrapLng(190)).toBeCloseTo(-170, 5);
    expect(wrapLng(-75)).toBe(-75);
  });
  it('faces where the places cluster, not the middle of a box round them all', () => {
    // mostly eastern US, one in Australia, one near the South Pole
    const pts = [
      { latitude: 39, longitude: -77 },
      { latitude: 42, longitude: -71 },
      { latitude: 35, longitude: -80 },
      { latitude: 34, longitude: -118 },
      { latitude: -33, longitude: 150 },
      { latitude: -81, longitude: 38 },
    ];
    const c = globeCenter(pts)!;
    expect(c.latitude).toBeGreaterThan(10);
    expect(c.longitude).toBeGreaterThan(-120);
    expect(c.longitude).toBeLessThan(-60);
  });
  it('is null for no places, or places spread evenly round the world', () => {
    expect(globeCenter([])).toBeNull();
    expect(globeCenter([{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 }])).toBeNull();
  });
});
