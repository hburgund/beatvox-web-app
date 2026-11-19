// A BeatVox video made again, on its share page, from what was sent to the
// map: the vox (the raw recording), its slices (the instrument), the loop
// MP3 and the recipe. Nothing is re-rendered: the beat is the loop exactly as
// it was heard (its effects, its humanized hits, an evolving beat's changes);
// only the voice before it is played again, the way the studio's render does:
//
//   [ LEAD ] [ the voice, leveled, through the effects' glue ] ½ bar [ the loop ] [ end card ]
//
// What a regenerated video can't know is the original's ring style (picked at
// random; a new one is picked) or the exact level of the voice against the beat
// (the two were levelled together, the loop on its own): the voice is brought
// to the loop's peak, which is close.
import type { Tape } from '../audio/engine';
import { FxChain, FX_KNOBS_OFF, knobsToParams } from '../audio/fx';
import { prepareVoice } from '../audio/prepare';
import { LEAD, voiceSpan } from '../audio/render';
import type { Cmd } from '../audio/voiceBank';
import type { Instrument } from '../instrument';
import { decodeBar, ROWS, STEPS } from '../played';
import { parsePattern, type Recipe } from '../recipe';
import { END_CARD, type VideoSource } from './script';

/** the bars a saved BeatVox has, when the loop doesn't say (SHARE_LOOPS in the studio) */
const SAVED_BARS = 8;
const DEFAULT_SPACE = 35;

/** The hits as heard, hits[step][row]: from `played`, or the patterns repeated for a beat saved without it. */
export function heardFromRecipe(recipe: Recipe, bars: number): boolean[][] {
  const played = recipe.played?.length ? recipe.played.map(decodeBar) : null;
  const start = Array.from({ length: ROWS }, (_, row) => {
    const v = recipe.voices[row];
    return v && v.on !== false ? parsePattern(v.pattern).hits : Array<boolean>(STEPS).fill(false);
  });
  const hits: boolean[][] = [];
  for (let b = 0; b < bars; b++) {
    const bar = played ? played[b % played.length] : start;
    for (let k = 0; k < STEPS; k++) hits.push(Array.from({ length: ROWS }, (_, row) => !!bar[row]?.[k]));
  }
  return hits;
}

/**
 * A stand-in for the capture the studio taped: a hit on every heard step, at
 * the start of the slice its row plays (what the video needs to colour a row
 * and light it up when that slice is heard in the voice). Times from 0.
 */
export function tapeFromRecipe(recipe: Recipe, instrument: Instrument, bars: number): Tape {
  const bpm = recipe.bpm ?? 120;
  const step = 60 / bpm / 4;
  const offsets = Array.from({ length: ROWS }, (_, row) => {
    const i = recipe.voices[row]?.slice;
    return typeof i === 'number' ? instrument.slices[i]?.start : undefined;
  });
  const cmds: Cmd[] = [];
  heardFromRecipe(recipe, bars).forEach((rows, s) =>
    rows.forEach((on, voice) => {
      const offset = offsets[voice];
      if (on && offset !== undefined) cmds.push({ k: 'hit', t: s * step, voice, offset, len: 0, rate: 1, level: 1, a: 0, h: 0 });
    }),
  );
  return { start: 0, end: bars * STEPS * step, loops: bars, bpm, head: [], cmds, recipe };
}

/** How many whole bars a loop of `seconds` holds at `bpm`. */
export function barsIn(seconds: number, bpm: number): number {
  const bar = (60 / bpm) * 4;
  return Math.max(1, Math.round(seconds / bar)) || SAVED_BARS;
}

/**
 * The video's source, made from the decoded vox (raw, as uploaded) and loop.
 * Both are decoded at one sample rate (`decode` below does that).
 */
export async function rebuildSource(recipe: Recipe, instrument: Instrument, raw: AudioBuffer, loop: AudioBuffer): Promise<VideoSource> {
  const sr = loop.sampleRate;
  const bpm = recipe.bpm ?? 120;
  const step = 60 / bpm / 4;
  const bars = barsIn(loop.duration, bpm);
  const tape = tapeFromRecipe(recipe, instrument, bars);
  const loopLen = Math.min(loop.length, Math.round(tape.end * sr));

  const ctx = new OfflineAudioContext(1, 1, sr);
  const { voice } = prepareVoice(ctx, raw);
  const span = voiceSpan(instrument.slices, voice.duration);
  const voiceDur = span.end - span.start;
  const remixAt = LEAD + voiceDur + 8 * step;

  // the voice through the effects' glue (EQ, compressor, limiter), as in the studio's render
  const voiced = await glue(voice, span, recipe, LEAD + voiceDur + 0.1);

  const length = Math.ceil((remixAt + tape.end + END_CARD) * sr);
  const out = new AudioBuffer({ length, numberOfChannels: 2, sampleRate: sr });
  const loopPeak = peak(loop, loopLen);
  const voicePeak = peak(voiced, voiced.length);
  const k = voicePeak > 1e-4 ? (loopPeak || 0.89) / voicePeak : 1;
  const at = Math.round(remixAt * sr);
  // a short fade where the loop ends (in the original its tail rang on)
  const fade = Math.min(loopLen, Math.round(0.3 * sr));
  for (let c = 0; c < 2; c++) {
    const o = out.getChannelData(c);
    const v = voiced.getChannelData(Math.min(c, voiced.numberOfChannels - 1));
    for (let i = 0; i < v.length && i < length; i++) o[i] = v[i] * k;
    const l = loop.getChannelData(Math.min(c, loop.numberOfChannels - 1));
    for (let i = 0; i < loopLen && at + i < length; i++) {
      const f = i >= loopLen - fade ? (loopLen - i) / fade : 1;
      o[at + i] += l[i] * f;
    }
  }
  return { fullAudio: out, remixAt, tape, voiceSpan: span, slices: instrument.slices };
}

async function glue(voice: AudioBuffer, span: { start: number; end: number }, recipe: Recipe, seconds: number): Promise<AudioBuffer> {
  const sr = voice.sampleRate;
  const voiceDur = span.end - span.start;
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
  const fx = new FxChain(ctx);
  fx.set(knobsToParams(recipe.space ?? DEFAULT_SPACE, { ...FX_KNOBS_OFF, ...recipe.fx }), 0);
  fx.setTempo(recipe.bpm ?? 120, 0);
  const src = ctx.createBufferSource();
  src.buffer = voice;
  const g = ctx.createGain();
  const f = 0.02;
  g.gain.setValueAtTime(0, LEAD);
  g.gain.linearRampToValueAtTime(1, LEAD + f);
  g.gain.setValueAtTime(1, LEAD + voiceDur - f);
  g.gain.linearRampToValueAtTime(0, LEAD + voiceDur);
  src.connect(g).connect(fx.clean);
  src.start(LEAD, span.start, voiceDur);
  return ctx.startRendering();
}

function peak(a: AudioBuffer, n: number) {
  let max = 0;
  for (let c = 0; c < a.numberOfChannels; c++) {
    const d = a.getChannelData(c);
    for (let i = 0; i < n && i < d.length; i++) max = Math.max(max, Math.abs(d[i]));
  }
  return max;
}

/** Fetch and decode the vox and the loop, at the loop's own rate where the browser allows it. */
export async function decode(voxUrl: string, loopUrl: string): Promise<{ raw: AudioBuffer; loop: AudioBuffer }> {
  const [voxBytes, loopBytes] = await Promise.all([voxUrl, loopUrl].map(async (u) => {
    const r = await fetch(u);
    if (!r.ok) throw new Error(`couldn't load the sound (${r.status})`);
    return r.arrayBuffer();
  }));
  // one rate for both, so their seconds agree
  const ctx = new OfflineAudioContext(1, 1, 48000);
  const [raw, loop] = await Promise.all([ctx.decodeAudioData(voxBytes), ctx.decodeAudioData(loopBytes)]);
  return { raw, loop };
}
