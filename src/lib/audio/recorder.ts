// Raw PCM mic recorder via AudioWorklet (same result on every browser, iOS included).

const WORKLET = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('bv-tap', Tap);
`;

const workletLoaded = new WeakSet<BaseAudioContext>();

export interface Recording {
  stop(): Promise<AudioBuffer>;
  /** resolves when recording ends, by stop() or by reaching maxSec */
  finished: Promise<AudioBuffer>;
  /** current input level 0..1 */
  level(): number;
}

export async function startRecording(ctx: AudioContext, opts: { maxSec: number; voiceProcessing: boolean }): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: opts.voiceProcessing,
      noiseSuppression: opts.voiceProcessing,
      autoGainControl: opts.voiceProcessing,
    },
  });
  if (!workletLoaded.has(ctx)) {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await ctx.audioWorklet.addModule(url);
    workletLoaded.add(ctx);
  }
  const src = ctx.createMediaStreamSource(stream);
  const tap = new AudioWorkletNode(ctx, 'bv-tap');
  const chunks: Float32Array[] = [];
  let total = 0;
  let peak = 0;
  const max = opts.maxSec * ctx.sampleRate;
  let resolveStop: (() => void) | null = null;
  tap.port.onmessage = (e: MessageEvent<Float32Array>) => {
    if (total >= max) return;
    chunks.push(e.data);
    total += e.data.length;
    for (const s of e.data) peak = Math.max(peak, Math.abs(s));
    if (total >= max) resolveStop?.();
  };
  src.connect(tap);
  // keep the worklet pulled without making it audible
  const mute = ctx.createGain();
  mute.gain.value = 0;
  tap.connect(mute).connect(ctx.destination);

  const done: Promise<void> = new Promise((r) => (resolveStop = r));

  const finish = async () => {
    src.disconnect();
    tap.disconnect();
    mute.disconnect();
    stream.getTracks().forEach((t) => t.stop()); // mic off as soon as we're done
    const buf = ctx.createBuffer(1, Math.max(1, Math.min(total, max)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    let o = 0;
    for (const c of chunks) {
      data.set(c.subarray(0, Math.min(c.length, data.length - o)), o);
      o += c.length;
      if (o >= data.length) break;
    }
    return buf;
  };
  const finished = done.then(finish);

  return {
    finished,
    stop: () => {
      resolveStop?.();
      return finished;
    },
    level: () => {
      const p = peak;
      peak *= 0.85;
      return p;
    },
  };
}
