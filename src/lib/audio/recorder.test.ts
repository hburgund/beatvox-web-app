import { describe, expect, it } from 'vitest';
import { micName, SILENT_PEAK } from './recorder';

describe('recorder', () => {
  it('names a mic without its USB ids', () => {
    expect(micName('USB audio CODEC (08bb:2912)')).toBe('USB audio CODEC');
    expect(micName('MacBook Pro Microphone (Built-in)')).toBe('MacBook Pro Microphone (Built-in)');
    expect(micName('')).toBe('');
    expect(micName(undefined)).toBe('');
  });

  it('counts a dead input as silent, not a quiet voice', () => {
    expect(0.001).toBeLessThan(SILENT_PEAK); // the USB CODEC with nothing in it
    expect(0.02).toBeGreaterThan(SILENT_PEAK);
  });
});
