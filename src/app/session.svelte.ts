// App state: the voice recording, its slices, the engine and what the UI shows.
// The audio engine is plain TypeScript; this class connects it to Svelte.

import { BeatEngine, VOICES, STEPS, type Voice } from '../lib/audio/engine';
import { FxChain, spaceToParams } from '../lib/audio/fx';
import { prepareVoice } from '../lib/audio/prepare';
import { startRecording, type Recording } from '../lib/audio/recorder';
import { DEFAULT_PARAMS, sliceSignal, type Slice } from '../lib/audio/slicer';
import { keepAwake } from '../lib/wakeLock';

export type Tab = 'record' | 'listen' | 'share';
export const MAX_RECORD_SEC = 15;

export class Session {
  tab = $state<Tab>('record');

  // recording
  voice = $state.raw<AudioBuffer | null>(null);
  mono = $state.raw<Float32Array | null>(null);
  slices = $state.raw<Slice[]>([]);
  recording = $state(false);
  remaining = $state(MAX_RECORD_SEC);
  level = $state(0);
  noisyRoom = $state(false);
  reviewing = $state(false);
  /** 0..1 playhead while reviewing the recording */
  reviewPos = $state(-1);
  status = $state('');

  // beat
  playing = $state(false);
  voices = $state.raw<Voice[]>([]);
  step = $state(-1);
  /** voices that fired on the current step */
  firing = $state.raw<number[]>([]);
  autoEvolve = $state(false);
  volume = $state(65);
  bpm = $state(89);
  panning = $state(60);
  pitch = $state(1);
  space = $state(35);

  private ctx: AudioContext | null = null;
  private fx: FxChain | null = null;
  private engine: BeatEngine | null = null;
  private rec: Recording | null = null;
  private recStart = 0;
  private review: AudioBufferSourceNode | null = null;
  private raf = 0;

  /** Create (or wake) the audio context. Must run inside a tap or click. */
  audio(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.fx = new FxChain(this.ctx);
      this.engine = new BeatEngine(this.ctx, this.fx);
      this.engine.onChange = () => this.sync();
      this.applyMix();
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
    return this.ctx;
  }

  // ── Record tab ────────────────────────────────────────────────────────

  async toggleRecord() {
    if (this.recording) return this.stopRecording();
    const ctx = this.audio();
    this.stopBeat();
    this.stopReview();
    try {
      this.rec = await startRecording(ctx, { maxSec: MAX_RECORD_SEC, voiceProcessing: this.noisyRoom });
    } catch (e) {
      this.status = `Couldn't open the microphone (${(e as Error).message}).`;
      return;
    }
    this.recording = true;
    this.status = '';
    this.recStart = ctx.currentTime;
    this.tick();
    const raw = await this.rec.finished;
    this.recording = false;
    this.rec = null;
    this.remaining = MAX_RECORD_SEC;
    this.level = 0;
    if (raw.duration < 0.5) {
      this.status = 'That was very short. Try again.';
      return;
    }
    this.setVoice(raw);
  }

  async stopRecording() {
    await this.rec?.stop();
  }

  async loadFile(file: File) {
    try {
      const buf = await this.audio().decodeAudioData(await file.arrayBuffer());
      this.setVoice(buf.duration > MAX_RECORD_SEC * 2 ? this.trim(buf, MAX_RECORD_SEC * 2) : buf);
    } catch (e) {
      this.status = `Couldn't read that file (${(e as Error).message}).`;
    }
  }

  /** dev only: load one of the local 2008 reference recordings */
  async loadUrl(url: string) {
    try {
      const data = await (await fetch(url)).arrayBuffer();
      this.setVoice(await this.audio().decodeAudioData(data));
    } catch (e) {
      this.status = `Couldn't load (${(e as Error).message}).`;
    }
  }

  private trim(buf: AudioBuffer, sec: number) {
    const n = Math.round(sec * buf.sampleRate);
    const out = this.audio().createBuffer(buf.numberOfChannels, n, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(0, n), c);
    return out;
  }

  private setVoice(raw: AudioBuffer) {
    const ctx = this.audio();
    const voice = prepareVoice(ctx, raw);
    const mono = voice.getChannelData(0);
    const { slices } = sliceSignal(mono, voice.sampleRate, 'mixed', DEFAULT_PARAMS);
    this.voice = voice;
    this.mono = mono;
    this.slices = slices;
    if (slices.length < 2) {
      this.status = 'Not much to slice there. Try speaking or beatboxing a bit louder.';
    } else {
      this.status = `${slices.length} slices`;
    }
    if (slices.length) this.engine!.load(voice, slices);
  }

  toggleReview() {
    if (this.reviewing) return this.stopReview();
    if (!this.voice) return;
    const ctx = this.audio();
    this.stopBeat();
    const src = ctx.createBufferSource();
    src.buffer = this.voice;
    src.connect(ctx.destination);
    const t0 = ctx.currentTime;
    src.start();
    this.review = src;
    this.reviewing = true;
    src.onended = () => {
      if (this.review === src) this.stopReview();
    };
    const dur = this.voice.duration;
    const step = () => {
      if (this.review !== src) return;
      this.reviewPos = (ctx.currentTime - t0) / dur;
      requestAnimationFrame(step);
    };
    step();
  }

  stopReview() {
    try {
      this.review?.stop();
    } catch {
      /* not started */
    }
    this.review = null;
    this.reviewing = false;
    this.reviewPos = -1;
  }

  /** NEW: start over with a new person */
  newPerson() {
    this.stopBeat();
    this.stopReview();
    this.voice = null;
    this.mono = null;
    this.slices = [];
    this.status = '';
    this.tab = 'record';
  }

  /** NEXT: on to the Listen tab, beat running */
  next() {
    if (!this.slices.length) return;
    this.stopReview();
    this.tab = 'listen';
    this.go();
  }

  // ── Listen tab ────────────────────────────────────────────────────────

  go() {
    if (!this.slices.length) return;
    this.audio();
    this.stopReview();
    this.engine!.start();
    keepAwake(true);
    this.tick();
  }

  stopBeat() {
    this.engine?.stop();
    keepAwake(false);
  }

  newBeat() {
    this.audio();
    this.engine?.newBeat();
  }

  evolve() {
    this.audio();
    this.engine?.evolve();
  }

  setAutoEvolve(on: boolean) {
    this.engine?.set({ autoEvolve: on });
    this.autoEvolve = on;
  }

  applyMix() {
    if (!this.engine || !this.fx) return;
    this.engine.set({ bpm: this.bpm, pitch: this.pitch, panning: this.panning / 100 });
    this.fx.setVolume(Math.pow(this.volume / 100, 2) * 1.25);
    this.fx.set(spaceToParams(this.space / 100));
  }

  private sync() {
    const e = this.engine!;
    this.voices = e.voices.map((v) => ({ ...v, pattern: [...v.pattern] }));
    this.playing = e.playing;
    this.autoEvolve = e.settings.autoEvolve;
    if (!e.playing) {
      this.step = -1;
      this.firing = [];
    }
  }

  /** one animation loop for meters, countdown and the grid playhead */
  private tick() {
    if (this.raf) return;
    const loop = () => {
      this.raf = 0;
      const ctx = this.ctx!;
      let again = false;
      if (this.recording && this.rec) {
        this.level = this.rec.level();
        this.remaining = Math.max(0, Math.ceil(MAX_RECORD_SEC - (ctx.currentTime - this.recStart)));
        again = true;
      }
      if (this.engine?.playing) {
        // what's audible now, allowing for output latency
        const now = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
        const evs = this.engine.drainEvents(now);
        if (evs.length) {
          const last = evs[evs.length - 1];
          this.step = last.step;
          this.firing = last.hits;
        }
        again = true;
      }
      if (again) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
}

export { VOICES, STEPS };
