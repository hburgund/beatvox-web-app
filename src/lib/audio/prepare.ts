// Clean up a fresh recording: mono, low-cut for rumble and handling noise,
// then two versions of it. Pure JS so it works the same everywhere.
//  - For slicing: peak-normalized. The slicer measures everything in dB
//    below the loudest moment, so this is exactly what it always saw.
//  - For playing (the beat, the MP3s, the videos): brought to a steady
//    loudness, measured over the voice only (not the silence around it),
//    with the boost capped so a whisper's room noise isn't pumped up, and
//    the odd peak (a "p", a bump) caught by a limiter instead of setting the
//    level for the whole recording.

/** 2nd-order Butterworth high-pass, in place. */
export function highpass(x: Float32Array, sampleRate: number, hz: number) {
  const w = (2 * Math.PI * hz) / sampleRate;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;
  const b0 = (1 + cos) / 2 / a0;
  const b1 = -(1 + cos) / a0;
  const b2 = b0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    x[i] = y0;
  }
}

export function normalize(x: Float32Array, peak = 0.95) {
  let max = 0;
  for (let i = 0; i < x.length; i++) max = Math.max(max, Math.abs(x[i]));
  if (max < 1e-4) return;
  const g = peak / max;
  for (let i = 0; i < x.length; i++) x[i] *= g;
}

export const DEFAULT_PREPARE = { lowCut: 80, normalize: 0.95 };

/** How the playing version is leveled. */
export const LEVEL = {
  /** RMS of the voice itself (dBFS), silence left out */
  targetDb: -18,
  /** most it will raise a recording above peak-normalized, dB */
  maxBoostDb: 12,
  /** most it will turn a loud one down, dB */
  maxCutDb: 6,
  /** frames this far below the loudest frame are silence or noise, not voice */
  gateDb: -30,
  /** the limiter's ceiling */
  ceiling: 0.95,
};

const toDb = (x: number) => 10 * Math.log10(x + 1e-20);

/**
 * Loudness of the voice in dBFS: RMS over 50 ms frames, leaving out frames
 * more than `gateDb` below the loudest (the silence and noise around it)
 * and the loudest tenth of what's left.
 */
export function voiceLoudness(x: Float32Array, sampleRate: number, gateDb = LEVEL.gateDb): number {
  const n = Math.max(1, Math.round(sampleRate * 0.05));
  const powers: number[] = [];
  for (let s = 0; s < x.length; s += n) {
    let sum = 0;
    const e = Math.min(x.length, s + n);
    for (let i = s; i < e; i++) sum += x[i] * x[i];
    powers.push(sum / (e - s));
  }
  const loudest = Math.max(0, ...powers);
  if (loudest <= 0) return -Infinity;
  const gate = loudest * 10 ** (gateDb / 10);
  // the voice's frames, less its loudest tenth: a plosive or a bump is a
  // frame or two, and shouldn't set the level any more than the peak should
  const voiced = powers.filter((p) => p >= gate).sort((a, b) => a - b);
  const keep = voiced.length >= 5 ? voiced.slice(0, voiced.length - Math.max(1, Math.floor(voiced.length / 10))) : voiced;
  return toDb(keep.reduce((s, p) => s + p, 0) / keep.length);
}

/**
 * A peak limiter, in place: looks 5 ms ahead so the gain is already down
 * when a peak arrives, lets go over 80 ms, and leaves anything under the
 * ceiling alone.
 */
export function limit(x: Float32Array, sampleRate: number, ceiling = LEVEL.ceiling) {
  const n = x.length;
  const ahead = Math.max(1, Math.round(sampleRate * 0.005));
  const want = new Float32Array(n);
  let over = false;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(x[i]);
    want[i] = a > ceiling ? ceiling / a : 1;
    if (a > ceiling) over = true;
  }
  if (!over) return;
  // the lowest gain wanted in the next `ahead` samples (a sliding minimum)
  const need = new Float32Array(n);
  const q: number[] = [];
  let head = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (q.length > head && want[q[q.length - 1]] >= want[i]) q.pop();
    q.push(i);
    while (q[head] > i + ahead) head++;
    need[i] = want[q[head]];
  }
  const attack = Math.exp(-1 / (sampleRate * 0.001));
  const release = Math.exp(-1 / (sampleRate * 0.08));
  let g = 1;
  for (let i = 0; i < n; i++) {
    const c = need[i] < g ? attack : release;
    g = need[i] + (g - need[i]) * c;
    // the clamp only catches what the 1 ms attack didn't quite reach
    x[i] = Math.max(-ceiling, Math.min(ceiling, x[i] * g));
  }
}

/** The playing version of a peak-normalized voice: leveled, then limited. Returns the gain used, in dB. */
export function level(x: Float32Array, sampleRate: number, opts = LEVEL): number {
  const loud = voiceLoudness(x, sampleRate, opts.gateDb);
  if (!Number.isFinite(loud)) return 0;
  const gainDb = Math.max(-opts.maxCutDb, Math.min(opts.maxBoostDb, opts.targetDb - loud));
  const g = 10 ** (gainDb / 20);
  for (let i = 0; i < x.length; i++) x[i] *= g;
  limit(x, sampleRate, opts.ceiling);
  return gainDb;
}

/**
 * A recording made ready: `mono` (peak-normalized) is for slicing and its
 * waveform; `voice` (leveled) is what's played and saved.
 */
export function prepareVoice(ctx: BaseAudioContext, input: AudioBuffer, opts = DEFAULT_PREPARE): { voice: AudioBuffer; mono: Float32Array } {
  const n = input.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < input.numberOfChannels; c++) {
    const d = input.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += d[i] / input.numberOfChannels;
  }
  highpass(mono, input.sampleRate, opts.lowCut);
  normalize(mono, opts.normalize);
  const played = mono.slice();
  level(played, input.sampleRate);
  const voice = ctx.createBuffer(1, n, input.sampleRate);
  voice.copyToChannel(played, 0);
  return { voice, mono };
}
