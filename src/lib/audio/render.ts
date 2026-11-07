// Render the shared piece offline:
//
//   [ the original voice ] ½ bar [ the captured loops ] effects tail
//
// The loops are played back from a Tape (the exact commands the engine sent
// while it was being heard) through a fresh voice bank and effects chain in
// an OfflineAudioContext, so a busy phone can't glitch the file.

import type { Tape } from './engine';
import { FxChain } from './fx';
import { VoiceBank, type Cmd } from './voiceBank';

export interface RenderOptions {
  /** the part of the voice to play first, in seconds (default: all of it) */
  voiceSpan?: { start: number; end: number };
  /** seconds of effects tail after the last loop */
  tail?: number;
  /** peak level of the finished file */
  peak?: number;
}

export interface Rendered {
  audio: AudioBuffer;
  /** where the remix starts, in seconds */
  remixAt: number;
}

const LEAD = 0.15;

/** The voice from just before its first slice to just after its last. */
export function voiceSpan(slices: { start: number; end: number }[], duration: number) {
  if (!slices.length) return { start: 0, end: duration };
  return {
    start: Math.max(0, slices[0].start - 0.08),
    end: Math.min(duration, slices[slices.length - 1].end + 0.25),
  };
}

/** Move a taped command to its place in the render. */
export function shift(c: Cmd, tape: Tape, remixAt: number): Cmd {
  return { ...c, t: Math.max(remixAt, c.t - tape.start + remixAt) };
}

export async function renderShare(tape: Tape, voice: AudioBuffer, opts: RenderOptions = {}): Promise<Rendered> {
  const sr = voice.sampleRate;
  const span = opts.voiceSpan ?? { start: 0, end: voice.duration };
  const tail = opts.tail ?? 3.5;
  const stepDur = 60 / tape.bpm / 4;
  const voiceDur = span.end - span.start;
  const remixAt = LEAD + voiceDur + 8 * stepDur;
  const total = remixAt + (tape.end - tape.start) + tail;

  const ctx = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
  const fx = new FxChain(ctx);
  const bank = new VoiceBank(ctx, fx);
  bank.setBuffer(voice);

  // effects as they were when the capture began, from the start, so the
  // voice gets the same EQ and compression as the beat
  for (const c of tape.head) bank.apply(c.k === 'pan' ? shift(c, tape, remixAt) : { ...c, t: 0 });

  // the original voice, centred and dry, with short fades
  const src = ctx.createBufferSource();
  src.buffer = voice;
  const g = ctx.createGain();
  const fade = 0.02;
  g.gain.setValueAtTime(0, LEAD);
  g.gain.linearRampToValueAtTime(1, LEAD + fade);
  g.gain.setValueAtTime(1, LEAD + voiceDur - fade);
  g.gain.linearRampToValueAtTime(0, LEAD + voiceDur);
  src.connect(g).connect(fx.dry);
  src.start(LEAD, span.start, voiceDur);

  // the loops
  for (const c of tape.cmds) bank.apply(shift(c, tape, remixAt));

  const rendered = await ctx.startRendering();
  const audio = finish(rendered, opts.peak ?? 0.89, remixAt + (tape.end - tape.start));
  return { audio, remixAt };
}

/**
 * Bring the peak to `peak` (0.89 ≈ -1 dBFS), cut the silence after the
 * effects die away (never before `keepUntil` seconds), and fade the end.
 */
export function finish(audio: AudioBuffer, peak: number, keepUntil = 0): AudioBuffer {
  const sr = audio.sampleRate;
  const chans = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c));
  let max = 0;
  for (const d of chans) for (let i = 0; i < d.length; i++) max = Math.max(max, Math.abs(d[i]));
  if (max < 1e-4) return audio;
  // last sample above -60 dB of the peak
  const floor = max * 1e-3;
  let last = 0;
  for (const d of chans) {
    for (let i = d.length - 1; i > last; i--) {
      if (Math.abs(d[i]) > floor) {
        last = i;
        break;
      }
    }
  }
  const length = Math.min(audio.length, Math.max(Math.round(keepUntil * sr), last) + Math.round(0.3 * sr));
  const out = new AudioBuffer({ length, numberOfChannels: chans.length, sampleRate: sr });
  const k = peak / max;
  const fadeLen = Math.min(length, Math.round(0.3 * sr));
  chans.forEach((d, c) => {
    const o = out.getChannelData(c);
    for (let i = 0; i < length; i++) o[i] = d[i] * k;
    for (let i = 0; i < fadeLen; i++) o[length - fadeLen + i] *= 1 - i / fadeLen;
  });
  return out;
}
