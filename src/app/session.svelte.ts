// App state: the voice recording, its slices, the engine and what the UI shows.
// The audio engine is plain TypeScript; this class connects it to Svelte.

import { BeatEngine, VOICES, STEPS, type Voice } from '../lib/audio/engine';
import { FxChain, spaceToParams } from '../lib/audio/fx';
import { encodeMp3 } from '../lib/audio/mp3';
import { renderShare, voiceSpan } from '../lib/audio/render';
import type { Recipe } from '../lib/recipe';
import { prepareVoice } from '../lib/audio/prepare';
import { playSlice } from '../lib/audio/beatPreview';
import { startRecording, type Recording } from '../lib/audio/recorder';
import type { Slice } from '../lib/audio/slicer';
import { cutInstrument, type Instrument } from '../lib/instrument';
import { keepAwake } from '../lib/wakeLock';
import { encodeWav } from '../lib/audio/wav';
import { newId } from '../lib/instrument';
import { Roundware, beatvoxShareUrl, RW_JSON, RW_TAGS, type RwPlace, type RwProject, type SendStep, type SentMix, type SentVoice } from '../lib/roundware';
import { STYLES } from '../lib/styles';

export const MAX_RECORD_SEC = 15;
/** loops in a shared piece (Simple mode; Advanced will offer 4 / 8 / 16) */
export const SHARE_LOOPS = 8;

/** idle → waiting (for the downbeat) → capturing → rendering → ready */
export type SharePhase = 'idle' | 'waiting' | 'capturing' | 'rendering' | 'ready';

export interface ShareFile {
  mp3: Blob;
  url: string;
  /** seconds */
  duration: number;
}

export interface ShareResult {
  /** your voice, then the beat: to save and send */
  full: ShareFile;
  /** the beat as a seamless loop: what goes to Roundware */
  loop: ShareFile & { audio: AudioBuffer; loops: number };
  /** where the beat starts in `full`, seconds */
  remixAt: number;
  /** the beat as it was when capture started, and the voice it played */
  recipe: Recipe;
  instrument: Instrument;
  /** the recording as made, before clean-up: what goes to Roundware */
  raw: AudioBuffer;
  recordedAt: Date;
  createdAt: Date;
}

/** idle → sending → sent (or back to idle with an error, to retry) */
export type SendPhase = 'idle' | 'sending' | 'sent';

export class Session {
  // recording
  voice = $state.raw<AudioBuffer | null>(null);
  /** the recording before clean-up */
  private raw: AudioBuffer | null = null;
  private recordedAt = new Date();
  mono = $state.raw<Float32Array | null>(null);
  slices = $state.raw<Slice[]>([]);
  /** the current voice, cut into slices (what a recipe plays) */
  instrument = $state.raw<Instrument | null>(null);
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
  /** the beat row a slice is being dragged over */
  dropRow = $state<number | null>(null);
  /** name of the style the beat started from, or '' for a random beat */
  style = $state('');

  // share
  share = $state<SharePhase>('idle');
  /** 0..1 through the capture */
  shareProgress = $state(0);
  shareResult = $state.raw<ShareResult | null>(null);
  shareTitle = $state('');
  shareStatus = $state('');
  /** the loop preview is playing */
  loopPlaying = $state(false);
  private loopSrc: AudioBufferSourceNode | null = null;

  // send to Roundware
  rw = new Roundware(newId);
  project = $state.raw<RwProject | null>(null);
  place = $state<RwPlace | null>(null);
  agreed = $state(false);
  revoxOk = $state(false);
  send = $state<SendPhase>('idle');
  sendStep = $state<SendStep | null>(null);
  sendError = $state('');
  /** the mix as it is on Roundware, once sent */
  sentMix = $state.raw<SentMix | null>(null);
  /** the current voice as it is on Roundware, once sent */
  private sentVoice: SentVoice | null = null;
  /** bumps to drop a capture or render that's out of date */
  private shareRun = 0;

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

  // ── Voice ─────────────────────────────────────────────────────────────

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
    const instrument = cutInstrument(mono, voice.sampleRate);
    this.raw = raw;
    this.recordedAt = new Date();
    this.sentVoice = null;
    this.voice = voice;
    this.mono = mono;
    this.instrument = instrument;
    this.slices = instrument.slices;
    this.style = '';
    if (instrument.slices.length < 2) {
      this.status = 'Not much to slice there. Try speaking or beatboxing a bit louder.';
    } else {
      this.status = `${instrument.slices.length} slices`;
    }
    this.discardShare();
    if (instrument.slices.length) {
      this.engine!.load(voice, instrument);
      // one screen: the beat starts as soon as the voice is cut
      this.go();
    }
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
    this.instrument = null;
    this.slices = [];
    this.status = '';
    this.style = '';
    this.discardShare();
  }

  // ── Beat ──────────────────────────────────────────────────────────────

  go() {
    if (!this.slices.length) return;
    this.audio();
    this.stopReview();
    this.stopLoop();
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
    this.style = '';
    this.engine?.newBeat();
  }

  /** Start from a genre style ('' = a random v1.93 beat). */
  applyStyle(name: string) {
    const r = STYLES.find((x) => x.name === name);
    if (!r) return this.newBeat();
    this.audio();
    this.style = name;
    if (r.bpm !== undefined) this.bpm = r.bpm;
    if (r.space !== undefined) this.space = r.space;
    if (r.panning !== undefined) this.panning = r.panning;
    this.engine?.applyRecipe(r);
  }

  evolve() {
    this.audio();
    this.engine?.evolve();
  }

  /** Add or remove one hit (on the next step while playing). */
  toggleStep(voice: number, step: number) {
    this.engine?.toggleStep(voice, step);
  }

  /** Hear one slice on its own (the beat keeps going). */
  hearSlice(i: number) {
    const s = this.slices[i];
    if (!s || !this.voice) return;
    playSlice(this.audio(), this.voice, s);
  }

  /** Make a beat row play this slice (dragged from the waveform). */
  setSlice(voice: number, slice: number) {
    this.engine?.setSlice(voice, slice);
  }

  /** Rest or wake one slice's row. */
  toggleVoice(voice: number) {
    this.engine?.toggleVoice(voice);
  }

  setAutoEvolve(on: boolean) {
    this.engine?.set({ autoEvolve: on });
    this.autoEvolve = on;
  }

  applyMix() {
    if (!this.engine || !this.fx) return;
    this.engine.set({ bpm: this.bpm, pitch: this.pitch, panning: this.panning / 100 });
    this.fx.setVolume(Math.pow(this.volume / 100, 2) * 1.25);
    this.engine.setFx(spaceToParams(this.space / 100));
  }

  // ── Save and share ────────────────────────────────────────────────────

  /** Capture SHARE_LOOPS bars from the next downbeat, then render the MP3. */
  async capture() {
    if (!this.voice || !this.instrument || !this.slices.length) return;
    if (this.share === 'waiting' || this.share === 'capturing' || this.share === 'rendering') return;
    this.discardShare();
    const run = ++this.shareRun;
    const voice = this.voice;
    const instrument = this.instrument;
    const raw = this.raw ?? voice;
    const recordedAt = this.recordedAt;
    this.go();
    const taped = this.engine!.capture(SHARE_LOOPS);
    this.share = 'waiting';
    this.shareProgress = 0;
    this.tick();
    let tape;
    try {
      tape = await taped;
    } catch (e) {
      if (run === this.shareRun) {
        this.share = 'idle';
        this.shareStatus = /stopped/.test((e as Error).message) ? 'The beat stopped before the capture finished. Try again.' : '';
      }
      return;
    }
    if (run !== this.shareRun) return;
    this.share = 'rendering';
    try {
      const t0 = performance.now();
      const { full, loop, remixAt } = await renderShare(tape, voice, { voiceSpan: voiceSpan(instrument.slices, voice.duration) });
      const t1 = performance.now();
      const [fullMp3, loopMp3] = await Promise.all([encodeMp3(full), encodeMp3(loop)]);
      if (import.meta.env.DEV) console.info(`share: render ${Math.round(t1 - t0)} ms, mp3 ${Math.round(performance.now() - t1)} ms`);
      if (run !== this.shareRun) return;
      this.shareResult = {
        full: { mp3: fullMp3, url: URL.createObjectURL(fullMp3), duration: full.duration },
        loop: { mp3: loopMp3, url: URL.createObjectURL(loopMp3), duration: loop.duration, audio: loop, loops: tape.loops },
        remixAt,
        recipe: tape.recipe,
        instrument,
        raw,
        recordedAt,
        createdAt: new Date(),
      };
      this.share = 'ready';
    } catch (e) {
      if (run !== this.shareRun) return;
      this.share = 'idle';
      this.shareStatus = `Couldn't make the MP3 (${(e as Error).message}).`;
    }
  }

  cancelCapture() {
    this.shareRun++;
    this.engine?.cancelCapture();
    if (this.share !== 'ready') this.share = 'idle';
  }

  /** forget the captured piece (a new voice, or capturing again) */
  discardShare() {
    this.shareRun++;
    this.engine?.cancelCapture();
    this.stopLoop();
    if (this.shareResult) {
      URL.revokeObjectURL(this.shareResult.full.url);
      URL.revokeObjectURL(this.shareResult.loop.url);
    }
    this.shareResult = null;
    this.sentMix = null;
    this.send = 'idle';
    this.sendStep = null;
    this.sendError = '';
    this.share = 'idle';
    this.shareProgress = 0;
    this.shareStatus = '';
  }

  /** Play the loop over and over (Web Audio loops it with no gap). */
  toggleLoop() {
    if (this.loopPlaying) return this.stopLoop();
    const r = this.shareResult;
    if (!r) return;
    const ctx = this.audio();
    this.stopBeat();
    this.stopReview();
    const src = ctx.createBufferSource();
    src.buffer = r.loop.audio;
    src.loop = true;
    src.connect(ctx.destination);
    src.start();
    this.loopSrc = src;
    this.loopPlaying = true;
  }

  stopLoop() {
    try {
      this.loopSrc?.stop();
    } catch {
      /* not started */
    }
    this.loopSrc = null;
    this.loopPlaying = false;
  }

  shareFileName(kind: 'full' | 'loop' = 'full') {
    const r = this.shareResult;
    const slug = this.shareTitle
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const d = r?.createdAt ?? new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
    return `beatvox-${slug || 'beat'}-${stamp}${kind === 'loop' ? '-loop' : ''}.mp3`;
  }

  private shareFile() {
    return new File([this.shareResult!.full.mp3], this.shareFileName(), { type: 'audio/mpeg' });
  }

  /** Can this device hand the file to its share sheet (phones, some laptops)? */
  canShareFile() {
    if (!this.shareResult || typeof navigator.canShare !== 'function') return false;
    try {
      return navigator.canShare({ files: [this.shareFile()] });
    } catch {
      return false;
    }
  }

  /** Save to the device as a download. */
  saveMp3(kind: 'full' | 'loop' = 'full') {
    if (!this.shareResult) return;
    const a = document.createElement('a');
    a.href = this.shareResult[kind].url;
    a.download = this.shareFileName(kind);
    document.body.append(a);
    a.click();
    a.remove();
  }

  /** Open the system share sheet with the MP3 attached. */
  async shareMp3() {
    if (!this.shareResult) return;
    try {
      await navigator.share({ files: [this.shareFile()], title: this.shareTitle || 'My BeatVox' });
    } catch (e) {
      // closing the share sheet isn't an error
      if ((e as Error).name !== 'AbortError') this.shareStatus = `Couldn't share (${(e as Error).message}). Try Save instead.`;
    }
  }

  /** After sending: a new beat with the same voice (its voice isn't sent again). */
  makeAnother() {
    this.discardShare();
    this.newBeat();
    this.go();
  }

  /** Share the link to the sent BeatVox (share sheet, or copy it). */
  async shareLink(): Promise<'shared' | 'copied' | 'failed'> {
    const url = this.sentMix && beatvoxShareUrl(this.sentMix.mixAsset);
    if (!url) return 'failed';
    const title = this.shareTitle || 'My BeatVox';
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ url, title });
        return 'shared';
      }
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch (e) {
      return (e as Error).name === 'AbortError' ? 'shared' : 'failed';
    }
  }

  /** The project's settings (terms, map centre), loaded once. */
  async loadProject() {
    if (this.project) return;
    try {
      this.project = await this.rw.getProject();
    } catch (e) {
      this.sendError = (e as Error).message;
    }
  }

  /**
   * Send the BeatVox to Roundware: the raw voice, the loop (child of the
   * voice), the instrument (child of the voice), the recipe (child of the
   * mix). Whatever already went up (an earlier try, or an earlier mix of the
   * same voice) isn't sent again.
   */
  async sendToMap() {
    const r = this.shareResult;
    const place = this.place;
    if (!r || !place || !this.agreed || !this.project || this.send !== 'idle') return;
    const terms = this.project.legal_agreement;
    const title = this.shareTitle.trim();
    const base = this.shareFileName('loop').replace(/-loop\.mp3$/, '');
    this.send = 'sending';
    this.sendError = '';
    try {
      let v = this.sentVoice?.instrumentId === r.instrument.id ? this.sentVoice : null;
      if (!v) {
        this.sendStep = 'voice';
        const a = await this.rw.upload({
          mediaType: 'audio',
          file: encodeWav(r.raw),
          fileName: `${base}-voice.wav`,
          place,
          tags: [RW_TAGS.source],
          description: title,
          agreedTerms: terms,
          recordedAt: r.recordedAt,
        });
        v = this.sentVoice = { instrumentId: r.instrument.id, voiceAsset: a.id };
      }
      let m = this.sentMix;
      if (!m) {
        this.sendStep = 'mix';
        const a = await this.rw.upload({
          mediaType: 'audio',
          file: r.loop.mp3,
          fileName: `${base}.mp3`,
          place,
          tags: [RW_TAGS.mix],
          parent: v.voiceAsset,
          description: title,
          agreedTerms: terms,
          recordedAt: r.createdAt,
        });
        m = this.sentMix = { mixAsset: a.id };
      }
      if (!v.instrumentAsset) {
        this.sendStep = 'instrument';
        const inst: Instrument = {
          ...r.instrument,
          source: { ...r.instrument.source, assetId: v.voiceAsset },
          revoxAllowed: this.revoxOk,
        };
        const a = await this.rw.upload({
          mediaType: RW_JSON.mediaType,
          file: new Blob([JSON.stringify(inst)], { type: RW_JSON.type }),
          fileName: `${base}-instrument.${RW_JSON.ext}`,
          place,
          tags: [RW_TAGS.instrument],
          parent: v.voiceAsset,
          description: title,
        });
        v.instrumentAsset = a.id;
      }
      if (!m.recipeAsset) {
        this.sendStep = 'recipe';
        const recipe: Recipe = {
          ...r.recipe,
          name: title || r.recipe.name,
          instrument: { id: r.instrument.id, assetId: v.voiceAsset },
        };
        const a = await this.rw.upload({
          mediaType: RW_JSON.mediaType,
          file: new Blob([JSON.stringify(recipe)], { type: RW_JSON.type }),
          fileName: `${base}-recipe.${RW_JSON.ext}`,
          place,
          tags: [RW_TAGS.recipe],
          parent: m.mixAsset,
          description: title,
        });
        this.sentMix = m = { ...m, recipeAsset: a.id };
      }
      this.send = 'sent';
      this.sendStep = null;
    } catch (e) {
      this.send = 'idle';
      this.sendError = (e as Error).message;
    }
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
      if (this.engine?.capturing) {
        const now = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
        const p = this.engine.captureProgress(now);
        if (p) {
          this.share = p.waiting ? 'waiting' : 'capturing';
          this.shareProgress = p.done;
        }
        again = true;
      }
      if (again) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
}

export { VOICES, STEPS };
