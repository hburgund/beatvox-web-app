// App state: the voice recording, its slices, the engine and what the UI shows.
// The audio engine is plain TypeScript; this class connects it to Svelte.

import { BeatEngine, VOICES, STEPS, type RowFill, type Voice, type Tape } from '../lib/audio/engine';
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
import { loadShared, ringRows } from '../lib/shared';
import { makeCardGif } from '../lib/card';
import { buildScript } from '../lib/video/script';
import { pickSprout, SHAPES, type Shape, type Sprout } from '../lib/video/draw';

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
  /** `full` as audio, the capture it was rendered from, and the part of the
   *  voice it starts with: what the video is drawn from */
  fullAudio: AudioBuffer;
  tape: Tape;
  voiceSpan: { start: number; end: number };
  /** the beat as it was when capture started, and the voice it played */
  recipe: Recipe;
  instrument: Instrument;
  /** the recording as made, before clean-up: what goes to Roundware */
  raw: AudioBuffer;
  recordedAt: Date;
  createdAt: Date;
  /** how the video's ring sprouts (picked once, the same for both shapes) */
  sprout: Sprout;
}

/** the sheet's steps after making it: put it on the map, then share it */
export type ShareStage = 'map' | 'share';

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
  /** 0..100: how much each hit varies (start, pitch, loudness, timing) */
  humanize = $state(60);
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
  /** the share card (animated ring GIF) for the current title, once drawn */
  card = $state.raw<{ title: string; gif: Blob; url: string } | null>(null);
  /** the card is being drawn */
  cardBusy = $state(false);
  private cardRun: Promise<Blob> | null = null;
  private cardRunTitle = '';
  /** map it, then share it (or skip the map and go straight to sharing) */
  shareStage = $state<ShareStage>('map');
  /** the video shape picked to share */
  videoShape = $state<Shape>('square');
  /** the videos made so far, for `videoTitle` */
  videos = $state.raw<Partial<Record<Shape, { blob: Blob; url: string }>>>({});
  /** 0..1 through making each video */
  videoProgress = $state<Record<Shape, number>>({ square: 0, tall: 0 });
  /** null until checked; false when this browser can't make that shape */
  videoOk = $state<Record<Shape, boolean | null>>({ square: null, tall: null });
  /** the caption went to the clipboard with the last video shared */
  captionCopied = $state(false);
  private videoTitle: string | null = null;
  private videoRun = 0;
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
  /** a reVox: someone else's vox, from the BeatVox it was shared in */
  revoxOf = $state.raw<{ mixId: number; title: string } | null>(null);
  /** loading a vox to reVox */
  revoxLoading = $state(false);
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

  /**
   * Use a voice: cut it into slices (or use the slices it came with, for a
   * reVox) and start the beat. A reVox starts from the beat it was shared
   * with and waits for Play, since it opens without a tap.
   */
  private setVoice(raw: AudioBuffer, revox?: { instrument: Instrument; sent: SentVoice; of: { mixId: number; title: string }; recipe: Recipe | null }) {
    const ctx = this.audio();
    const voice = prepareVoice(ctx, raw);
    const mono = voice.getChannelData(0);
    const instrument = revox?.instrument ?? cutInstrument(mono, voice.sampleRate);
    this.raw = raw;
    this.recordedAt = new Date();
    this.sentVoice = revox?.sent ?? null;
    this.revoxOf = revox?.of ?? null;
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
    if (!instrument.slices.length) return;
    const recipe = revox?.recipe ?? undefined;
    if (recipe) {
      if (recipe.bpm !== undefined) this.bpm = recipe.bpm;
      if (recipe.pitch !== undefined) this.pitch = recipe.pitch;
      if (recipe.panning !== undefined) this.panning = recipe.panning;
      if (recipe.space !== undefined) this.space = recipe.space;
      if (recipe.humanize !== undefined) this.humanize = Math.round(recipe.humanize * 100);
    }
    this.engine!.load(voice, instrument, recipe);
    // one screen: the beat starts as soon as the voice is cut
    if (!revox) this.go();
  }

  /**
   * Open someone else's vox to make your own beat with it (a reVox), from the
   * BeatVox a share page showed. Sending it later adds only your mix and
   * recipe, under their vox.
   */
  async loadRevox(mixId: number) {
    this.revoxLoading = true;
    this.status = '';
    try {
      const d = await loadShared(mixId);
      if (d.status !== 'live') {
        this.status = d.status === 'pending' ? "That BeatVox isn't approved yet, so its vox can't be reVoxed." : "Couldn't find that BeatVox.";
        return;
      }
      if (!d.revoxAllowed || !d.instrument || d.instrumentAsset === null) {
        this.status = 'The maker kept that vox to themselves. Record your own instead!';
        return;
      }
      const data = await (await fetch(d.vox.file)).arrayBuffer();
      const raw = await this.audio().decodeAudioData(data);
      this.setVoice(raw, {
        instrument: d.instrument,
        sent: { instrumentId: d.instrument.id, voiceAsset: d.vox.id, instrumentAsset: d.instrumentAsset },
        of: { mixId: d.mix.id, title: d.mix.title },
        recipe: d.mix.recipe,
      });
    } catch {
      this.status = "Couldn't load that vox. Check your connection and try again.";
    } finally {
      this.revoxLoading = false;
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
    this.revoxOf = null;
    this.sentVoice = null;
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
    if (r.humanize !== undefined) this.humanize = Math.round(r.humanize * 100);
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

  /** Set one row's level, 0..1 (the Mix view). */
  setLevel(voice: number, level: number) {
    this.engine?.setLevel(voice, level);
  }

  /** Set one row to a quick pattern (the Pattern view). */
  fillRow(voice: number, fill: RowFill) {
    this.engine?.fillRow(voice, fill);
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
    this.engine.set({ bpm: this.bpm, pitch: this.pitch, panning: this.panning / 100, humanize: this.humanize / 100 });
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
      const span = voiceSpan(instrument.slices, voice.duration);
      const { full, loop, remixAt } = await renderShare(tape, voice, { voiceSpan: span });
      const t1 = performance.now();
      const [fullMp3, loopMp3] = await Promise.all([encodeMp3(full), encodeMp3(loop)]);
      if (import.meta.env.DEV) console.info(`share: render ${Math.round(t1 - t0)} ms, mp3 ${Math.round(performance.now() - t1)} ms`);
      if (run !== this.shareRun) return;
      this.shareResult = {
        full: { mp3: fullMp3, url: URL.createObjectURL(fullMp3), duration: full.duration },
        loop: { mp3: loopMp3, url: URL.createObjectURL(loopMp3), duration: loop.duration, audio: loop, loops: tape.loops },
        remixAt,
        fullAudio: full,
        tape,
        voiceSpan: span,
        recipe: tape.recipe,
        instrument,
        raw,
        recordedAt,
        createdAt: new Date(),
        sprout: pickSprout(),
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
    if (this.card) URL.revokeObjectURL(this.card.url);
    this.card = null;
    this.cardRun = null;
    this.dropVideos();
    this.shareStage = 'map';
    this.captionCopied = false;
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

  shareFileName(kind: 'full' | 'loop' | 'gif' | Shape = 'full') {
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
    const ext = { full: '.mp3', loop: '-loop.mp3', gif: '.gif', square: '.mp4', tall: '-tall.mp4' }[kind];
    return `beatvox-${slug || 'beat'}-${stamp}${ext}`;
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

  /**
   * The share card for the title as it is now: drawn once per title (the
   * sheet shows it, SAVE GIF saves it, sending uploads it).
   */
  cardGif(): Promise<Blob> {
    const r = this.shareResult;
    if (!r) return Promise.reject(new Error('nothing captured'));
    const title = this.shareTitle.trim();
    if (this.card?.title === title) return Promise.resolve(this.card.gif);
    if (this.cardRun && this.cardRunTitle === title) return this.cardRun;
    const run = makeCardGif(ringRows(r.recipe), { title: title || r.recipe.name }, r.recipe.bpm ?? this.bpm);
    this.cardRun = run;
    this.cardRunTitle = title;
    this.cardBusy = true;
    run
      .then((gif) => {
        // a newer title (or a new capture) took over meanwhile
        if (this.cardRun !== run) return;
        if (this.card) URL.revokeObjectURL(this.card.url);
        this.card = { title, gif, url: URL.createObjectURL(gif) };
      })
      .catch(() => {})
      .finally(() => {
        if (this.cardRun === run) {
          this.cardRun = null;
          this.cardBusy = false;
        }
      });
    return run;
  }

  private gifFile(gif: Blob) {
    return new File([gif], this.shareFileName('gif'), { type: 'image/gif' });
  }

  /** Save the share card as a download, like the other save links. */
  async saveGif() {
    try {
      download(this.gifFile(await this.cardGif()));
    } catch {
      this.shareStatus = "Couldn't save the GIF. Try again.";
    }
  }

  // ── The videos ────────────────────────────────────────────────────────

  /** the name on the video (and the card) */
  private titleNow() {
    return this.shareTitle.trim() || this.shareResult?.recipe.name || 'My BeatVox';
  }

  /**
   * Make both videos for the name as it is now, in the background: the shape
   * picked first, then the other, one at a time (so the first isn't slowed).
   * Each is a few MB, held in memory only, and let go with the BeatVox.
   */
  makeVideos() {
    const r = this.shareResult;
    if (!r) return;
    const title = this.titleNow();
    if (this.videoTitle === title) return;
    this.dropVideos();
    this.videoTitle = title;
    const run = this.videoRun;
    void (async () => {
      // the encoder loads only now, not with the studio
      const { canMakeVideo, makeVideo } = await import('../lib/video/encode');
      for (const shape of SHAPES) if (this.videoOk[shape] === null) this.videoOk[shape] = await canMakeVideo(shape).catch(() => false);
      const sc = buildScript({ fullAudio: r.fullAudio, remixAt: r.remixAt, tape: r.tape, voiceSpan: r.voiceSpan, slices: r.instrument.slices }, title);
      await document.fonts.load(`700 30px 'Courier Prime'`).catch(() => {});
      const failed = new Set<Shape>();
      for (;;) {
        if (run !== this.videoRun) return;
        const todo = (x: Shape) => this.videoOk[x] && !this.videos[x] && !failed.has(x);
        const shape = todo(this.videoShape) ? this.videoShape : SHAPES.find(todo);
        if (!shape) return;
        const t0 = performance.now();
        try {
          const blob = await makeVideo(sc, r.sprout, shape, r.fullAudio, {
            progress: (p) => run === this.videoRun && (this.videoProgress[shape] = p),
            cancelled: () => run !== this.videoRun,
          });
          if (run !== this.videoRun) return;
          if (import.meta.env.DEV) console.info(`video ${shape}: ${Math.round(performance.now() - t0)} ms, ${(blob.size / 1e6).toFixed(1)} MB`);
          this.videos = { ...this.videos, [shape]: { blob, url: URL.createObjectURL(blob) } };
        } catch (e) {
          if ((e as Error).name === 'AbortError' || run !== this.videoRun) return;
          console.warn(`video ${shape}:`, e);
          failed.add(shape);
          this.videoOk[shape] = false;
        }
      }
    })();
  }

  private dropVideos() {
    this.videoRun++;
    this.videoTitle = null;
    for (const v of Object.values(this.videos)) if (v) URL.revokeObjectURL(v.url);
    this.videos = {};
    this.videoProgress = { square: 0, tall: 0 };
  }

  /** The caption to paste with the video: its own link once it's on the map, else the project's. */
  caption() {
    const t = this.shareTitle.trim();
    const name = t ? `My BeatVox, “${t}”` : 'My BeatVox';
    return this.sentMix
      ? `${name}: a beat made from one voice. Hear it on the map and make your own: ${beatvoxShareUrl(this.sentMix.mixAsset)} #beatvox`
      : `${name}: a beat made from one voice. Make your own: ${globalThis.location?.origin ?? ''} #beatvox`;
  }

  private videoFile(shape: Shape) {
    const v = this.videos[shape];
    return v && new File([v.blob], this.shareFileName(shape), { type: 'video/mp4' });
  }

  /** Can this device hand a video to its share sheet? */
  canShareVideo() {
    if (typeof navigator.canShare !== 'function') return false;
    try {
      return navigator.canShare({ files: [new File([], 'beatvox.mp4', { type: 'video/mp4' })] });
    } catch {
      return false;
    }
  }

  /**
   * Share the picked video (the share sheet, straight from the tap: it has to
   * be made already) and copy the caption, since most apps drop text sent
   * with a file. Without a share sheet, save it.
   */
  async shareVideo() {
    const file = this.videoFile(this.videoShape);
    if (!file) return;
    const caption = this.caption();
    const copied = navigator.clipboard?.writeText(caption).then(
      () => true,
      () => false,
    );
    try {
      if (this.canShareVideo()) await navigator.share({ files: [file], title: this.shareTitle || 'My BeatVox', text: caption });
      else download(file);
      this.captionCopied = (await copied) ?? false;
    } catch (e) {
      this.captionCopied = (await copied) ?? false;
      if ((e as Error).name !== 'AbortError') this.shareStatus = `Couldn't share the video (${(e as Error).message}). Try saving it.`;
    }
  }

  /** Save the picked video to this device. */
  saveVideo() {
    const file = this.videoFile(this.videoShape);
    if (file) download(file);
  }

  /** After sending: a new beat with the same voice (its voice isn't sent again). */
  makeAnother() {
    this.discardShare();
    this.newBeat();
    this.go();
  }

  /** Share the link to the sent BeatVox (share sheet, or copy it). */
  async shareLink(): Promise<'shared' | 'copied' | 'failed'> {
    const url = this.sentMix ? beatvoxShareUrl(this.sentMix.mixAsset) : globalThis.location?.origin;
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
      // reVox permission is also a tag, on the vox and on every mix of it,
      // so the map can filter by it; sent only once the live server has it
      const known = await this.rw.tagIds().catch(() => new Set<number>());
      const allowed = this.revoxOf ? true : this.revoxOk;
      const permit = allowed && known.has(RW_TAGS.revoxAllowed) ? [RW_TAGS.revoxAllowed] : [];
      let v = this.sentVoice?.instrumentId === r.instrument.id ? this.sentVoice : null;
      if (!v) {
        this.sendStep = 'voice';
        const a = await this.rw.upload({
          mediaType: 'audio',
          file: encodeWav(r.raw),
          fileName: `${base}-voice.wav`,
          place,
          tags: [RW_TAGS.source, ...permit],
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
          tags: [this.revoxOf ? RW_TAGS.revoxMix : RW_TAGS.mix, ...permit],
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
      // the share card, for link previews; worth trying, never worth failing a send
      if (!m.cardUrl && known.has(RW_TAGS.card)) {
        this.sendStep = 'card';
        try {
          const gif = await this.cardGif();
          const a = await this.rw.upload({
            mediaType: 'photo',
            file: gif,
            fileName: `${base}-card.gif`,
            place,
            tags: [RW_TAGS.card],
            parent: m.mixAsset,
            description: title,
          });
          this.sentMix = m = { ...m, cardAsset: a.id, cardUrl: a.file ?? undefined };
        } catch {
          /* the preview falls back to BeatVox's own picture */
        }
      }
      if (!m.recipeAsset) {
        this.sendStep = 'recipe';
        const recipe: Recipe = {
          ...r.recipe,
          name: title || r.recipe.name,
          instrument: { id: r.instrument.id, assetId: v.voiceAsset },
          mixAssetId: m.mixAsset,
          ...(m.cardUrl ? { cardUrl: m.cardUrl } : {}),
          ...(this.revoxOf ? { revoxOf: this.revoxOf.mixId } : {}),
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

/** Save a file the browser's way (Downloads, or the Files app on a phone). */
function download(file: File) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
