// Frame-level analysis shared by all slicers: one STFT pass produces
// every feature curve the slicers need.

export const FFT_SIZE = 1024;
export const HOP = 256;

/** In-place radix-2 complex FFT. */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export interface Features {
  sampleRate: number;
  frames: number;
  /** seconds per frame step */
  frameDur: number;
  /** frame RMS level in dB relative to the loudest frame (≤ 0) */
  levelDb: Float32Array;
  /** speech-band (300–3000 Hz) energy in dB relative to its loudest frame (≤ 0) */
  bandDb: Float32Array;
  /** half-wave-rectified log spectral flux, normalized so the 99th percentile ≈ 1 */
  flux: Float32Array;
}

const toDb = (x: number) => 10 * Math.log10(x + 1e-12);

/** Frame i is centered on sample i*HOP. */
export function analyze(signal: Float32Array, sampleRate: number): Features {
  const frames = Math.ceil(signal.length / HOP) + 1;
  const half = FFT_SIZE / 2;
  const win = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT_SIZE);

  const lo = Math.floor((300 / sampleRate) * FFT_SIZE);
  const hi = Math.ceil((3000 / sampleRate) * FFT_SIZE);

  const level = new Float32Array(frames);
  const band = new Float32Array(frames);
  const flux = new Float32Array(frames);
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  let prev = new Float32Array(half + 1);
  let cur = new Float32Array(half + 1);

  for (let f = 0; f < frames; f++) {
    const start = f * HOP - half;
    let sq = 0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const s = signal[start + i] ?? 0;
      sq += s * s;
      re[i] = s * win[i];
      im[i] = 0;
    }
    level[f] = sq / FFT_SIZE;
    fft(re, im);
    let b = 0, fl = 0;
    for (let k = 0; k <= half; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      if (k >= lo && k <= hi) b += p;
      // log compression keeps quiet consonants visible next to loud vowels
      cur[k] = Math.log1p(100 * Math.sqrt(p) / half);
      const d = cur[k] - prev[k];
      if (d > 0) fl += d;
    }
    band[f] = b;
    flux[f] = f === 0 ? 0 : fl;
    [prev, cur] = [cur, prev];
  }

  const levelDb = toRelDb(level);
  const bandDb = toRelDb(band);
  const sorted = Float32Array.from(flux).sort();
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 1;
  for (let f = 0; f < frames; f++) flux[f] /= p99;

  return { sampleRate, frames, frameDur: HOP / sampleRate, levelDb, bandDb, flux };
}

function toRelDb(power: Float32Array) {
  let max = 0;
  for (const p of power) if (p > max) max = p;
  const out = new Float32Array(power.length);
  const ref = toDb(max);
  for (let i = 0; i < power.length; i++) out[i] = Math.max(-100, toDb(power[i]) - ref);
  return out;
}

/** Centered moving average. */
export function smooth(x: Float32Array, radius: number) {
  if (radius < 1) return Float32Array.from(x);
  const out = new Float32Array(x.length);
  let sum = 0, n = 0;
  for (let i = 0; i < Math.min(radius, x.length); i++) { sum += x[i]; n++; }
  for (let i = 0; i < x.length; i++) {
    const add = i + radius, drop = i - radius - 1;
    if (add < x.length) { sum += x[add]; n++; }
    if (drop >= 0) { sum -= x[drop]; n--; }
    out[i] = sum / n;
  }
  return out;
}

/** Peak-normalized mono mixdown. */
export function toMono(buffer: AudioBuffer): Float32Array {
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / buffer.numberOfChannels;
  }
  let peak = 0;
  for (const s of out) peak = Math.max(peak, Math.abs(s));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;
  return out;
}
