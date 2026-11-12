// What a BeatVox video shows and when, worked out from a saved BeatVox: its
// "voice, then the beat" audio (the video's soundtrack), the capture that
// audio was rendered from (every hit as it was heard, so an evolving beat
// shows as it evolves) and the slices. Times are seconds on the soundtrack.
import { LEAD } from '../audio/render';
import type { Tape } from '../audio/engine';
import type { Role } from '../recipe';

/** how long the end card holds after the last bar */
export const END_CARD = 3;
/** the project's link, on the video (people won't type a link with an id) */
export const VIDEO_LINK = 'beatvox.app';

export interface VideoRow {
  /** the drum role of the slice this row plays (sets its color) */
  sound?: Exclude<Role, 'any'>;
  /** when that slice is heard in the voice, or null for a row that never plays */
  heardAt: number | null;
}

export interface VideoScript {
  title: string;
  link: string;
  voiceStart: number;
  voiceEnd: number;
  /** the beat's first downbeat */
  beatAt: number;
  /** one sixteenth, seconds */
  step: number;
  /** sixteenths in the beat (8 bars = 128) */
  steps: number;
  /** after the last bar: the end card from here */
  end: number;
  /** the whole video */
  length: number;
  rows: VideoRow[];
  /** hits[step][row] */
  hits: boolean[][];
  /** loudness 0..1 of the soundtrack from 0 to voiceEnd, `envRate` values a second */
  env: Float32Array;
  envRate: number;
}

export interface VideoSource {
  fullAudio: AudioBuffer;
  remixAt: number;
  tape: Tape;
  voiceSpan: { start: number; end: number };
  slices: { start: number; end: number; role?: Exclude<Role, 'any'> }[];
}

const ROWS = 8;

/** The step a taped hit belongs to. Swing and humanize land hits a little late, never early. */
export function stepOf(t: number, start: number, step: number) {
  return Math.floor((t - start) / step + 0.35);
}

export function buildScript(src: VideoSource, title: string, link = VIDEO_LINK): VideoScript {
  const { tape } = src;
  const step = 60 / tape.bpm / 4;
  const steps = tape.loops * 16;
  const hits = Array.from({ length: steps }, () => Array<boolean>(ROWS).fill(false));
  const firstSlice: (number | null)[] = Array(ROWS).fill(null);
  for (const c of tape.cmds) {
    if (c.k !== 'hit' || c.voice >= ROWS) continue;
    const s = stepOf(c.t, tape.start, step);
    if (s < 0 || s >= steps) continue;
    hits[s][c.voice] = true;
    if (firstSlice[c.voice] === null) {
      // the hit starts inside its slice (a skipped click at most)
      const i = src.slices.findIndex((x) => c.offset >= x.start - 1e-6 && c.offset < x.end);
      if (i >= 0) firstSlice[c.voice] = i;
    }
  }
  const rows: VideoRow[] = firstSlice.map((i) =>
    i === null ? { heardAt: null } : { sound: src.slices[i].role, heardAt: LEAD + src.slices[i].start - src.voiceSpan.start },
  );
  const voiceEnd = LEAD + (src.voiceSpan.end - src.voiceSpan.start);
  const envRate = 100;
  const end = src.remixAt + steps * step;
  return {
    title,
    link,
    voiceStart: LEAD,
    voiceEnd,
    beatAt: src.remixAt,
    step,
    steps,
    end,
    length: end + END_CARD,
    rows,
    hits,
    env: loudness(src.fullAudio, voiceEnd, envRate),
    envRate,
  };
}

/** RMS loudness of `audio` from 0 to `until`, `rate` values a second, scaled so the loudest is 1. */
export function loudness(audio: AudioBuffer, until: number, rate: number): Float32Array {
  const n = Math.max(1, Math.ceil(until * rate));
  const out = new Float32Array(n);
  const win = Math.max(1, Math.floor(audio.sampleRate / rate));
  const chans = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c));
  let max = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i * win; j < (i + 1) * win && j < audio.length; j++) {
      for (const ch of chans) sum += ch[j] * ch[j];
      count += chans.length;
    }
    out[i] = count ? Math.sqrt(sum / count) : 0;
    max = Math.max(max, out[i]);
  }
  // a gentle curve, so quieter syllables still move things
  if (max > 0) for (let i = 0; i < n; i++) out[i] = Math.sqrt(out[i] / max);
  return out;
}
