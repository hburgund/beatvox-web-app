import { describe, it, expect } from 'vitest';
import { greatCircle } from './greatCircle';

describe('greatCircle', () => {
  it('bows toward the pole, as the shortest route does (New York to London)', () => {
    const path = greatCircle([-74, 40.7], [-0.13, 51.5]);
    expect(path).toHaveLength(65);
    expect(path[0]).toEqual([-74, 40.7]);
    expect(path[64][0]).toBeCloseTo(-0.13, 6);
    expect(path[64][1]).toBeCloseTo(51.5, 6);
    // a straight Mercator line would stay below 51.5°; the great circle rises above it
    expect(Math.max(...path.map((p) => p[1]))).toBeGreaterThan(51.5);
    // its middle is around 52°N, 41°W
    expect(path[32][1]).toBeGreaterThan(50);
    expect(path[32][1]).toBeLessThan(54);
    expect(path[32][0]).toBeGreaterThan(-46);
    expect(path[32][0]).toBeLessThan(-36);
  });

  it('crosses the Pacific the short way, without jumping at the date line', () => {
    const path = greatCircle([139.7, 35.7], [-122.4, 37.8]);
    for (let i = 1; i < path.length; i++) expect(Math.abs(path[i][0] - path[i - 1][0])).toBeLessThan(10);
    // it heads east past 180° rather than west across Asia
    expect(path[path.length - 1][0]).toBeCloseTo(-122.4 + 360, 6);
  });

  it('gives just the two points for the same place', () => {
    expect(greatCircle([10, 10], [10, 10])).toEqual([
      [10, 10],
      [10, 10],
    ]);
  });
});
