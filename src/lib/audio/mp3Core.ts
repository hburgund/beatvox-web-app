// MP3 encoding with LAME (compiled to WebAssembly by wasm-media-encoders).
// The core is plain code so it can be tested in Node; mp3.ts runs it in a
// worker in the browser.
//
// The encoder doesn't write a gapless header, so players would add ~25 ms
// of silence at the start and some padding at the end, which breaks loops.
// addGaplessTag() adds the standard LAME "Info" frame that tells decoders
// (browsers, FFmpeg) exactly how many samples to skip at each end.

import type { WasmMediaEncoder } from 'wasm-media-encoders';

export const MP3_BITRATE = 192;
/** samples LAME adds before the audio */
export const ENCODER_DELAY = 576;
const SAMPLES_PER_FRAME = 1152;
const CHUNK = SAMPLES_PER_FRAME * 32;

/** Encode stereo (or mono) float PCM to a gapless MP3. */
export function encodeWith(
  encoder: WasmMediaEncoder<'audio/mpeg'>,
  channels: Float32Array[],
  sampleRate: number,
  bitrate: typeof MP3_BITRATE = MP3_BITRATE,
): Uint8Array {
  encoder.configure({ channels: channels.length as 1 | 2, sampleRate, bitrate });
  const parts: Uint8Array[] = [];
  // the encoder reuses its output buffer, so copy each piece out
  const keep = (b: Uint8Array) => {
    if (b.length) parts.push(b.slice());
  };
  const n = channels[0].length;
  for (let i = 0; i < n; i += CHUNK) keep(encoder.encode(channels.map((c) => c.subarray(i, Math.min(n, i + CHUNK)))));
  keep(encoder.finalize());
  return addGaplessTag(concat(parts), n);
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];

/** MPEG-1 Layer III frame header at `i`, or null */
export function frameAt(b: Uint8Array, i: number) {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xfe) !== 0xfa) return null;
  const br = BITRATES[b[i + 2] >> 4];
  const sr = RATES[(b[i + 2] >> 2) & 3];
  if (!br || !sr) return null;
  const pad = (b[i + 2] >> 1) & 1;
  const mono = b[i + 3] >> 6 === 3;
  return { size: Math.floor((144000 * br) / sr) + pad, bitrate: br, sampleRate: sr, mono };
}

/** CRC-16 as LAME uses it (poly 0x8005, reflected, init 0) */
function crc16(b: Uint8Array, end: number) {
  let crc = 0;
  for (let i = 0; i < end; i++) {
    crc ^= b[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc;
}

/** Put a LAME "Info" frame in front of a CBR stream: frame count, size, encoder delay and padding. */
export function addGaplessTag(mp3: Uint8Array, samples: number): Uint8Array {
  const first = frameAt(mp3, 0);
  if (!first) return mp3;
  let frames = 0;
  for (let i = 0; i < mp3.length; ) {
    const f = frameAt(mp3, i);
    if (!f) break;
    frames++;
    i += f.size;
  }
  const padding = frames * SAMPLES_PER_FRAME - ENCODER_DELAY - samples;
  if (padding < 0 || padding > 4095) return mp3;

  const size = Math.floor((144000 * first.bitrate) / first.sampleRate);
  const tag = new Uint8Array(size);
  tag.set(mp3.subarray(0, 4));
  tag[2] &= ~0x02; // no padding byte in this frame
  const be32 = (o: number, v: number) => {
    tag[o] = v >>> 24;
    tag[o + 1] = (v >>> 16) & 255;
    tag[o + 2] = (v >>> 8) & 255;
    tag[o + 3] = v & 255;
  };
  let o = 4 + (first.mono ? 17 : 32); // after the (empty) side info
  tag.set([...'Info'].map((c) => c.charCodeAt(0)), o);
  be32(o + 4, 0x0f); // frames, bytes, TOC and quality follow
  be32(o + 8, frames);
  const total = size + mp3.length;
  be32(o + 12, total);
  for (let k = 0; k < 100; k++) tag[o + 16 + k] = Math.floor((k * 256) / 100); // even TOC (CBR)
  be32(o + 116, 0); // quality
  o += 120;
  // LAME extension
  tag.set([...'LAME3.100'].map((c) => c.charCodeAt(0)), o);
  tag[o + 9] = 0x01; // revision 0, CBR
  // o+10 lowpass, o+11..18 replay gain, o+19 encoding flags: left at 0
  tag[o + 20] = Math.min(255, first.bitrate);
  tag[o + 21] = ENCODER_DELAY >> 4;
  tag[o + 22] = ((ENCODER_DELAY & 15) << 4) | (padding >> 8);
  tag[o + 23] = padding & 255;
  const len = o + 28;
  be32(len, total);
  const crcAt = o + 34;
  const crc = crc16(tag, crcAt);
  tag[crcAt] = crc >> 8;
  tag[crcAt + 1] = crc & 255;
  return concat([tag, mp3]);
}
