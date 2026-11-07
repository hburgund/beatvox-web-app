import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createEncoder } from 'wasm-media-encoders';
import { ENCODER_DELAY, encodeWith, frameAt } from './mp3Core';

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

describe('addGaplessTag', () => {
  it('fronts the stream with a LAME Info frame giving delay and padding', async () => {
    const sr = 48000;
    const n = 30_000;
    const l = new Float32Array(n).map((_, i) => 0.3 * Math.sin(i / 10));
    const mp3 = encodeWith(await createEncoder('audio/mpeg', wasm), [l, l], sr);
    const f = frameAt(mp3, 0)!;
    expect(f.size).toBe(576); // 192 kbps at 48 kHz
    const text = (a: number, len: number) => String.fromCharCode(...mp3.subarray(a, a + len));
    expect(text(36, 4)).toBe('Info');
    expect(text(156, 9)).toBe('LAME3.100');
    const frames = (mp3[44] << 24) | (mp3[45] << 16) | (mp3[46] << 8) | mp3[47];
    const d = (mp3[177] << 16) | (mp3[178] << 8) | mp3[179];
    expect(d >> 12).toBe(ENCODER_DELAY);
    // the frames hold exactly delay + audio + padding
    expect(frames * 1152).toBe(ENCODER_DELAY + n + (d & 4095));
    expect(frameAt(mp3, 576)).not.toBeNull();
  });
});
