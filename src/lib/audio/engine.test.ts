import { describe, expect, it } from 'vitest';
import { BeatEngine, STEPS, PATTERNS } from './engine';
import { FxChain } from './fx';
import type { Slice } from './slicer';
import { STYLES } from '../styles';
import { parsePattern, type Role } from '../recipe';
import { createInstrument, validateInstrument, type Instrument } from '../instrument';
import { DEFAULT_PARAMS } from './slicer';
import { DEFAULT_PREPARE } from './prepare';
import type { RoleScores } from './drumRoles';

// Just enough of Web Audio for the engine to run in Node.
function fakeContext() {
  // every gain a hit's envelope rises to (choke ramps go to 0, so they're skipped)
  const peaks: number[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime(v: number) {
      if (v > 0) peaks.push(v);
    },
    setTargetAtTime() {},
    setValueCurveAtTime() {},
  });
  const started: { when: number; offset: number }[] = [];
  const node = (extra: object = {}) => ({
    connect(n: unknown) {
      return n;
    },
    disconnect() {},
    ...extra,
  });
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    destination: node(),
    createGain: () => node({ gain: param() }),
    createStereoPanner: () => node({ pan: param() }),
    createConstantSource: () => node({ offset: param(), start() {}, stop() {} }),
    createDelay: () => node({ delayTime: param() }),
    createBiquadFilter: () => node({ type: '', frequency: param(), Q: param(), gain: param() }),
    createDynamicsCompressor: () =>
      node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createConvolver: () => node({ buffer: null }),
    createBuffer: (ch: number, len: number, sr: number) => {
      const data = Array.from({ length: ch }, () => new Float32Array(len));
      return { numberOfChannels: ch, length: len, sampleRate: sr, getChannelData: (c: number) => data[c] };
    },
    createBufferSource: () =>
      node({
        buffer: null,
        playbackRate: param(),
        onended: null,
        start(when: number, offset: number) {
          started.push({ when, offset });
        },
        stop() {},
      }),
  };
  return { ctx: ctx as unknown as BaseAudioContext, started, peaks };
}

const slices: Slice[] = Array.from({ length: 12 }, (_, i) => ({ start: i * 0.3, end: i * 0.3 + 0.2, peakDb: -6 }));
const buffer = { duration: 4, length: 44100 * 4, sampleRate: 44100 } as AudioBuffer;

/** An instrument whose slice i is a clear `roles[i]` (cycled). */
function instrumentWith(roles: Exclude<Role, 'any'>[]): Instrument {
  const scores = slices.map((_, i): RoleScores => {
    const r = roles[i % roles.length];
    return { kick: 0.1, snare: 0.1, hat: 0.1, perc: 0.1, tonal: 0.1, [r]: 0.9 };
  });
  return createInstrument({
    slices,
    scores,
    bestRoles: slices.map((_, i) => roles[i % roles.length]),
    duration: 4,
    sampleRate: 44100,
    method: 'mixed',
    params: DEFAULT_PARAMS,
    prepare: DEFAULT_PREPARE,
  });
}

function setup(seed = 42, instrument = instrumentWith(['kick', 'snare', 'hat', 'perc', 'tonal'])) {
  const { ctx, started, peaks } = fakeContext();
  const fx = new FxChain(ctx);
  const engine = new BeatEngine(ctx, fx, seed);
  engine.load(buffer, instrument);
  return { ctx, engine, started, peaks, instrument };
}

/** run the scheduler for `seconds` of audio time */
function play(engine: BeatEngine, ctx: BaseAudioContext, seconds: number) {
  const c = ctx as unknown as { currentTime: number };
  engine.start();
  const end = c.currentTime + seconds;
  while (c.currentTime < end) {
    c.currentTime += 0.025;
    engine.schedule(c.currentTime + 0.12);
  }
}

describe('BeatEngine', () => {
  it('kicks off with one voice on quarter notes', () => {
    const { engine } = setup();
    const on = engine.voices.filter((v) => v.on);
    expect(on).toHaveLength(1);
    expect(engine.voices[0].pattern).toEqual(PATTERNS.quarters);
  });

  it('deals a different slice to every voice', () => {
    const { engine } = setup();
    expect(new Set(engine.voices.map((v) => v.slice)).size).toBe(8);
  });

  it('adds voices at 5 s and 10 s, then turns on auto-evolve', () => {
    const { engine, ctx } = setup();
    play(engine, ctx, 4.5);
    expect(engine.voices.filter((v) => v.on)).toHaveLength(1);
    play(engine, ctx, 3);
    expect(engine.voices[1].on).toBe(true);
    expect(engine.voices[1].pattern).toEqual(PATTERNS.eighths);
    play(engine, ctx, 6);
    expect(engine.voices[2].on).toBe(true);
    expect(engine.settings.autoEvolve).toBe(true);
    engine.stop();
  });

  it('applies changes on the downbeat while playing', () => {
    const { engine, ctx } = setup();
    play(engine, ctx, 0.5); // mid-bar
    const before = engine.version;
    engine.newBeat();
    expect(engine.version).toBe(before); // queued, not applied
    play(engine, ctx, 3); // a bar is ~2.7 s at 89 BPM
    expect(engine.version).toBeGreaterThan(before);
    engine.stop();
  });

  it('applies changes at once when stopped', () => {
    const { engine } = setup();
    const before = engine.version;
    engine.toggleStep(0, 1);
    expect(engine.version).toBe(before + 1);
    expect(engine.voices[0].pattern[1]).toBe(true);
  });

  it('keeps slices unique through many evolves', () => {
    const { engine } = setup(7);
    for (let i = 0; i < 300; i++) engine.evolve();
    expect(new Set(engine.voices.map((v) => v.slice)).size).toBe(8);
    const on = engine.voices.filter((v) => v.on).length;
    expect(on).toBeGreaterThanOrEqual(1);
    expect(on).toBeLessThanOrEqual(8);
  });

  it('is repeatable from the same seed', () => {
    const a = setup(99);
    const b = setup(99);
    play(a.engine, a.ctx, 20);
    play(b.engine, b.ctx, 20);
    expect(a.started.length).toBeGreaterThan(50);
    expect(b.started).toEqual(a.started);
  });

  it('plays hits on the sixteenth-note grid', () => {
    const { engine, ctx, started } = setup();
    play(engine, ctx, 3);
    const step = 60 / 89 / 4;
    const t0 = started[0].when;
    for (const s of started) {
      const k = (s.when - t0) / step;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
    }
    expect(STEPS).toBe(16);
  });

  it('loads a style recipe: patterns, accents, swing, no kickoff', () => {
    const { engine, ctx, started } = setup();
    const house = STYLES.find((x) => x.name === 'House')!;
    engine.applyRecipe(house);
    expect(engine.voices.filter((v) => v.on)).toHaveLength(house.voices.length);
    expect(engine.voices[0].pattern).toEqual(parsePattern(house.voices[0].pattern).hits);
    expect(engine.voices[0].accent[0]).toBeGreaterThan(1);
    expect(engine.settings.bpm).toBe(124);
    expect(new Set(engine.voices.map((v) => v.slice)).size).toBe(8);
    play(engine, ctx, 8);
    // no kickoff voices joined, no auto-evolve
    expect(engine.voices.filter((v) => v.on)).toHaveLength(house.voices.length);
    // off-beat sixteenths land late by swing × step
    const step = 60 / 124 / 4;
    const t0 = started[0].when;
    const late = started.filter((s) => Math.round((s.when - t0) / step) % 2 === 1);
    expect(late.length).toBeGreaterThan(0);
    for (const s of late) {
      const k = (s.when - t0) / step;
      expect(k - Math.floor(k)).toBeCloseTo(0.05, 5);
    }
    engine.stop();
  });

  it('humanize wanders each hit below the steady track level', () => {
    const { engine, ctx, peaks } = setup();
    const one = (level: number, humanize: number) => ({
      format: 'beatvox-recipe' as const,
      version: 1,
      name: 't',
      kind: 'style' as const,
      humanize,
      voices: [{ pattern: 'x'.repeat(16), level }],
    });
    // humanize 0: every hit at exactly the level
    engine.applyRecipe(one(0.5, 0));
    play(engine, ctx, 4);
    engine.stop();
    expect(peaks.length).toBeGreaterThan(20);
    for (const p of peaks) expect(p).toBeCloseTo(0.5, 9);
    expect(engine.voices[0].level).toBe(0.5);

    // humanize 1 (v1.93): hits wander between 0.45× and 1× of the level
    peaks.length = 0;
    engine.applyRecipe(one(0.8, 1));
    play(engine, ctx, 8);
    engine.stop();
    expect(Math.min(...peaks)).toBeGreaterThanOrEqual(0.8 * 0.45 - 1e-9);
    expect(Math.max(...peaks)).toBeLessThanOrEqual(0.8 + 1e-9);
    expect(new Set(peaks.map((p) => p.toFixed(3))).size).toBeGreaterThan(10);
    expect(engine.voices[0].level).toBe(0.8);
    expect(engine.toRecipe('t').humanize).toBe(1);
  });

  it('builds a valid instrument that survives JSON', () => {
    const { instrument } = setup();
    expect(validateInstrument(JSON.parse(JSON.stringify(instrument)))).toEqual(instrument);
  });

  it('saves the beat as a recipe that names its instrument', () => {
    const { engine, instrument } = setup();
    const r = engine.toRecipe('mine');
    expect(r.kind).toBe('beat');
    expect(r.instrument?.id).toBe(instrument.id);
    expect(r.voices[0].sliceRole).toBe(instrument.slices[r.voices[0].slice!].role);
  });

  it('a reVox (another instrument) picks slices by the sound they had', () => {
    const a = setup(5);
    for (let i = 0; i < 20; i++) a.engine.evolve();
    const beat = JSON.parse(JSON.stringify(a.engine.toRecipe('mine')));
    // the other voice has its roles in a different order
    const b = setup(6, instrumentWith(['tonal', 'hat', 'kick', 'perc', 'snare']));
    b.engine.applyRecipe(beat);
    const other = b.instrument;
    b.engine.voices.forEach((v, i) => {
      // patterns carry over, slice numbers don't
      expect(v.pattern).toEqual(a.engine.voices[i].pattern);
      expect(other.slices[v.slice].role).toBe(beat.voices[i].sliceRole);
    });
  });

  it('saves the beat as a recipe and loads it back exactly', () => {
    const a = setup(5);
    for (let i = 0; i < 20; i++) a.engine.evolve();
    const json = JSON.stringify(a.engine.toRecipe('mine'));
    const b = setup(6, a.instrument);
    b.engine.applyRecipe(JSON.parse(json));
    const strip = (e: BeatEngine) => e.voices.map(({ on, slice, pattern }) => ({ on, slice, pattern }));
    expect(strip(b.engine)).toEqual(strip(a.engine));
  });
});
