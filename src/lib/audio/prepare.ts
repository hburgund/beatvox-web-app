// Clean up a fresh recording before slicing: mono, low-cut for rumble and
// handling noise, then normalize. Pure JS so it works the same everywhere.

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

/** A mono, low-cut, normalized copy of any buffer. */
export function prepareVoice(ctx: BaseAudioContext, input: AudioBuffer, opts = DEFAULT_PREPARE): AudioBuffer {
  const n = input.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < input.numberOfChannels; c++) {
    const d = input.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += d[i] / input.numberOfChannels;
  }
  highpass(mono, input.sampleRate, opts.lowCut);
  normalize(mono, opts.normalize);
  const out = ctx.createBuffer(1, n, input.sampleRate);
  out.copyToChannel(mono, 0);
  return out;
}
