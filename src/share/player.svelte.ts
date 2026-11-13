// Plays one thing at a time on the share page: the beat's loop (gapless,
// round and round), the source vox once, or another beat from the family.
// While a loop plays, `step` follows it from the audio clock, so the ring's
// wedge stays on the beat. Each play of an asset is a Roundware listen.

import { rw } from '../lib/rw';

export interface PlayOpts {
  loop: boolean;
  bpm?: number;
  /** a one-shot played to its end (not stopped) */
  onend?: () => void;
  /** seconds to fade in from silence */
  fadeIn?: number;
  /** a one-shot: seconds to fade out before its end */
  fadeOut?: number;
  /** its Roundware asset, logged as a listen while it plays */
  asset?: number;
}

export class Player {
  /** what's playing: a key the page chose, or null */
  playing = $state<string | null>(null);
  /** the step (0–15) of the playing loop, or -1 */
  step = $state(-1);
  /** what's loading */
  loading = $state<string | null>(null);
  error = $state('');

  private ctx: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private raf = 0;
  /** the asset being heard, for the listen log */
  private asset: number | null = null;

  private audio() {
    this.ctx ??= new AudioContext();
    return this.ctx;
  }

  /** Fetch and decode ahead of time, so a tap starts at once. */
  preload(url: string) {
    let p = this.buffers.get(url);
    if (!p) {
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.arrayBuffer();
        })
        .then((b) => this.audio().decodeAudioData(b));
      p.catch(() => this.buffers.delete(url));
      this.buffers.set(url, p);
    }
    return p;
  }

  /**
   * Start or stop `key`. A loop with `bpm` drives `step`: the saved loop is
   * whole bars, so its length divided into bars gives the bar.
   */
  async toggle(key: string, url: string, opts: PlayOpts) {
    if (this.playing === key) return this.stop();
    return this.play(key, url, opts);
  }

  /** Start `key` (stopping anything else). `onend` runs when a one-shot finishes by itself. */
  async play(key: string, url: string, opts: PlayOpts) {
    this.stop();
    const ctx = this.audio();
    void ctx.resume();
    this.loading = key;
    this.error = '';
    let buf: AudioBuffer;
    try {
      buf = await this.preload(url);
    } catch {
      if (this.loading === key) this.loading = null;
      this.error = "Couldn't load the sound. Check your connection and try again.";
      return;
    }
    // another tap came in while this loaded
    if (this.loading !== key) return;
    this.loading = null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = opts.loop;
    const gain = ctx.createGain();
    src.connect(gain).connect(ctx.destination);
    const t0 = ctx.currentTime + 0.05;
    const fadeIn = Math.min(opts.fadeIn ?? 0, buf.duration / 3);
    const fadeOut = opts.loop ? 0 : Math.min(opts.fadeOut ?? 0, buf.duration / 3);
    gain.gain.setValueAtTime(fadeIn ? 0 : 1, t0);
    if (fadeIn) gain.gain.linearRampToValueAtTime(1, t0 + fadeIn);
    if (fadeOut) {
      gain.gain.setValueAtTime(1, t0 + buf.duration - fadeOut);
      gain.gain.linearRampToValueAtTime(0, t0 + buf.duration);
    }
    src.start(t0);
    src.onended = () => {
      if (this.src !== src) return;
      this.stop();
      opts.onend?.();
    };
    this.src = src;
    this.gain = gain;
    this.playing = key;
    if (opts.asset !== undefined) {
      this.asset = opts.asset;
      rw.hear(opts.asset);
    }
    if (opts.bpm) {
      const barLen = 240 / opts.bpm;
      const bars = Math.max(1, Math.round(buf.duration / barLen));
      const bar = buf.duration / bars;
      const tick = () => {
        // what's heard now is what was scheduled outputLatency ago
        const t = ctx.currentTime - t0 - (ctx.outputLatency || 0);
        this.step = t < 0 ? -1 : Math.floor(((t % bar) / bar) * 16) % 16;
        this.raf = requestAnimationFrame(tick);
      };
      tick();
    }
  }

  /** Stop what's playing, at once or fading out over `fade` seconds. */
  stop(fade = 0) {
    cancelAnimationFrame(this.raf);
    const src = this.src;
    const gain = this.gain;
    this.src = null;
    this.gain = null;
    try {
      if (src && gain && fade > 0 && this.ctx) {
        const t = this.ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + fade);
        src.stop(t + fade + 0.02);
      } else src?.stop();
    } catch {
      /* not started */
    }
    this.playing = null;
    this.loading = null;
    this.step = -1;
    if (this.asset !== null) rw.unhear(this.asset);
    this.asset = null;
  }
}
