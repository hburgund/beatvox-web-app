// YIN pitch estimate for a slice: median f0 over its voiced frames.

const W = 512;     // window at the 2x-downsampled rate (~23 ms)
const MIN_HZ = 70;
const MAX_HZ = 600;
const THRESH = 0.15;

export interface PitchResult {
  hz: number | null;
  /** share of frames that were voiced, 0..1 */
  voiced: number;
}

export function slicePitch(signal: Float32Array, sampleRate: number, start: number, end: number): PitchResult {
  // downsample 2x by averaging (cheap low-pass) to cut the cost of the difference function
  const sr = sampleRate / 2;
  const a = Math.floor(start * sampleRate), b = Math.min(signal.length, Math.floor(end * sampleRate));
  const n = Math.floor((b - a) / 2);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = (signal[a + 2 * i] + (signal[a + 2 * i + 1] ?? 0)) / 2;

  const tauMin = Math.floor(sr / MAX_HZ);
  const tauMax = Math.min(Math.ceil(sr / MIN_HZ), W - 1);
  const hop = W / 2;
  const estimates: number[] = [];
  let frames = 0;
  const d = new Float32Array(tauMax + 1);

  for (let off = 0; off + W + tauMax < n && frames < 24; off += hop, frames++) {
    // skip near-silent frames
    let e = 0;
    for (let i = 0; i < W; i++) e += x[off + i] * x[off + i];
    if (e / W < 1e-4) continue;

    d.fill(0);
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) {
        const v = x[off + i] - x[off + i + tau];
        s += v * v;
      }
      d[tau] = s;
    }
    // cumulative mean normalized difference
    let run = 0;
    d[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      run += d[tau];
      d[tau] = run > 0 ? (d[tau] * tau) / run : 1;
    }
    let tau = tauMin;
    for (; tau <= tauMax; tau++) {
      if (d[tau] < THRESH) {
        while (tau + 1 <= tauMax && d[tau + 1] < d[tau]) tau++;
        break;
      }
    }
    if (tau > tauMax) continue;
    // parabolic interpolation
    const y0 = d[tau - 1], y1 = d[tau], y2 = d[tau + 1] ?? y1;
    const den = y0 + y2 - 2 * y1;
    const t = den !== 0 ? tau + (y0 - y2) / (2 * den) : tau;
    estimates.push(sr / t);
  }

  if (frames === 0 || estimates.length === 0) return { hz: null, voiced: 0 };
  estimates.sort((p, q) => p - q);
  return { hz: estimates[Math.floor(estimates.length / 2)], voiced: estimates.length / frames };
}

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function noteName(hz: number) {
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  return NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}
