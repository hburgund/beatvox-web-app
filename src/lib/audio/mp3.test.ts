import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createEncoder } from 'wasm-media-encoders';
import { encodeWith } from './mp3Core';

const wasm = readFileSync(createRequire(import.meta.url).resolve('wasm-media-encoders/wasm/mp3'));

describe('encodeWith', () => {
  it('makes a 192 kbps stereo MP3 of the right length', async () => {
    const sr = 44100;
    const secs = 3;
    const l = new Float32Array(sr * secs).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr));
    const r = l.map((x) => -x);
    const mp3 = encodeWith(await createEncoder('audio/mpeg', wasm), [l, r], sr);
    // frame sync: 11 set bits
    expect(mp3[0]).toBe(0xff);
    expect(mp3[1] & 0xe0).toBe(0xe0);
    // 192 kbps × 3 s ≈ 72 KB
    expect(mp3.length).toBeGreaterThan(60_000);
    expect(mp3.length).toBeLessThan(85_000);
  });
});
