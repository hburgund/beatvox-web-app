// MP3 encoding with LAME (compiled to WebAssembly by wasm-media-encoders).
// The core is plain code so it can be tested in Node; mp3.ts runs it in a
// worker in the browser.

import type { WasmMediaEncoder } from 'wasm-media-encoders';

export const MP3_BITRATE = 192;
const CHUNK = 1152 * 32;

/** Encode stereo (or mono) float PCM to MP3 bytes. */
export function encodeWith(
  encoder: WasmMediaEncoder<'audio/mpeg'>,
  channels: Float32Array[],
  sampleRate: number,
  bitrate: typeof MP3_BITRATE = MP3_BITRATE,
): Uint8Array {
  encoder.configure({ channels: channels.length as 1 | 2, sampleRate, bitrate });
  const parts: Uint8Array[] = [];
  let size = 0;
  // the encoder reuses its output buffer, so copy each piece out
  const keep = (b: Uint8Array) => {
    if (!b.length) return;
    parts.push(b.slice());
    size += b.length;
  };
  const n = channels[0].length;
  for (let i = 0; i < n; i += CHUNK) keep(encoder.encode(channels.map((c) => c.subarray(i, Math.min(n, i + CHUNK)))));
  keep(encoder.finalize());
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
