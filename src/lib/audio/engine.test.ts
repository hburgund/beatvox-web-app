import { describe, expect, it } from 'vitest';
import { BeatEngine, STEPS, PATTERNS } from './engine';
import { FxChain } from './fx';
import type { Slice } from './slicer';
import { STYLES } from '../styles';
import { parsePattern } from '../recipe';

// Just enough of Web Audio for the engine to run in Node.
function fakeContext() {
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
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
  return { ctx: ctx as unknown as BaseAudioContext, started };
}

const slices: Slice[] = Array.from({ length: 12 }, (_, i) => ({ start: i * 0.3, end: i * 0.3 + 0.2, peakDb: -6 }));
const buffer = { duration: 4, length: 44100 * 4, sampleRate: 44100 } as AudioBuffer;

function setup(seed = 42) {
  const { ctx, started } = fakeContext();
  const fx = new FxChain(ctx);
  const engine = new BeatEngine(ctx, fx, seed);
  engine.load(buffer, slices);
  return { ctx, engine, started };
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

  it('saves the beat as a recipe and loads it back exactly', () => {
    const a = setup(5);
    for (let i = 0; i < 20; i++) a.engine.evolve();
    const json = JSON.stringify(a.engine.toRecipe('mine'));
    const b = setup(6);
    b.engine.applyRecipe(JSON.parse(json));
    const strip = (e: BeatEngine) => e.voices.map(({ on, slice, pattern }) => ({ on, slice, pattern }));
    expect(strip(b.engine)).toEqual(strip(a.engine));
  });
});
