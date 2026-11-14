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

/** On the dev server, what the recorder did, for the console. */
const trace = (...a: unknown[]) => {
  if (import.meta.env.DEV) console.info('[recording]', ...a);
};

/**
 * Below this, the loudest moment of a recording is a dead input (the wrong
 * mic: a USB device with nothing plugged in measured 0.001), not a quiet
 * voice, which peaks well above 0.02 even across a room.
 */
export const SILENT_PEAK = 0.005;

/** A mic's name as people know it: "USB audio CODEC (08bb:2912)" is "USB audio CODEC". */
export function micName(label: string | undefined): string {
  return (label ?? '').replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim();
}

export interface Recording {
  /** the microphone's name, or '' if the browser won't say */
  mic: string;
  /** the loudest moment so far, 0..1 */
  loudest(): number;
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
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0) + ' ms';
  const track = stream.getAudioTracks()[0];
  trace('mic', track?.label || '(no label)', track?.readyState, track?.muted ? 'MUTED' : 'not muted', track?.getSettings());
  trace('audio context', ctx.state, ctx.sampleRate + ' Hz');
  if (track) {
    track.onmute = () => trace('mic muted', ms());
    track.onunmute = () => trace('mic unmuted', ms());
    track.onended = () => trace('mic ended', ms());
  }
  if (!workletLoaded.has(ctx)) {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    try {
      await ctx.audioWorklet.addModule(url);
    } catch (e) {
      trace('worklet failed to load', e);
      throw e;
    }
    workletLoaded.add(ctx);
    trace('worklet loaded', ms());
  }
  const src = ctx.createMediaStreamSource(stream);
  const tap = new AudioWorkletNode(ctx, 'bv-tap');
  const chunks: Float32Array[] = [];
  let total = 0;
  let peak = 0;
  const max = opts.maxSec * ctx.sampleRate;
  let resolveStop: (() => void) | null = null;
  let loudest = 0;
  let reported = 0;
  tap.port.onmessage = (e: MessageEvent<Float32Array>) => {
    if (total >= max) return;
    if (!total) trace('first audio', ms(), e.data.length + ' samples');
    chunks.push(e.data);
    total += e.data.length;
    for (const s of e.data) peak = Math.max(peak, Math.abs(s));
    loudest = Math.max(loudest, peak);
    if (import.meta.env.DEV && total - reported >= ctx.sampleRate) {
      reported = total;
      trace((total / ctx.sampleRate).toFixed(0) + ' s in', 'loudest so far', loudest.toFixed(3), 'context', ctx.state);
    }
    if (total >= max) resolveStop?.();
  };
  src.connect(tap);
  // keep the worklet pulled without making it audible
  const mute = ctx.createGain();
  mute.gain.value = 0;
  tap.connect(mute).connect(ctx.destination);

  const done: Promise<void> = new Promise((r) => (resolveStop = r));

  setTimeout(() => {
    if (!total) trace('no audio after 2 s', 'context', ctx.state, 'mic', track?.readyState, track?.muted ? 'MUTED' : 'not muted');
  }, 2000);

  const finish = async () => {
    trace('stopped', ms(), (total / ctx.sampleRate).toFixed(1) + ' s', chunks.length + ' chunks', 'loudest', loudest.toFixed(3), 'context', ctx.state);
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
    mic: micName(track?.label),
    loudest: () => loudest,
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
