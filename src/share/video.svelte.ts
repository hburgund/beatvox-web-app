// The share page's video: a BeatVox's video made again, for anyone who
// wants to post it (its maker, who didn't save it at the time, or anyone
// else). Made in this browser, only when asked, one shape at a time; held in
// memory while the page is open. Nothing is stored anywhere.
import { beatvoxShareUrl } from '../lib/roundware';
import { rw } from '../lib/rw';
import type { Instrument } from '../lib/instrument';
import type { Recipe } from '../lib/recipe';
import { pickSprout, type Shape } from '../lib/video/draw';
import { buildScript, type VideoScript } from '../lib/video/script';

export interface VideoMix {
  id: number;
  title: string;
  /** the loop MP3 */
  file: string;
  recipe: Recipe;
}

/** Can this BeatVox's video be made again? It needs its recipe and its slices. */
export function canRebuild(recipe: Recipe | null, instrument: Instrument | null): boolean {
  return !!recipe && !!instrument && instrument.slices.length > 0 && recipe.voices.length > 0;
}

export class ShareVideo {
  shape = $state<Shape>('square');
  /** can this browser make each shape (null: not asked yet) */
  ok = $state<Record<Shape, boolean | null>>({ square: null, tall: null });
  progress = $state<Record<Shape, number>>({ square: 0, tall: 0 });
  videos = $state.raw<Partial<Record<Shape, { blob: Blob; url: string }>>>({});
  /** fetching and decoding the sounds */
  loading = $state(false);
  error = $state('');
  /** the script, once the sounds are in (for the preview still) */
  script = $state.raw<VideoScript | null>(null);
  captionCopied = $state(false);
  readonly sprout = pickSprout();

  private audio: AudioBuffer | null = null;
  private busy = false;
  private run = 0;

  constructor(
    private mix: VideoMix,
    private voxUrl: string,
    private instrument: Instrument,
  ) {}

  /** Make the picked shape, if it isn't made yet (and keep going if it's picked again while one is being made). */
  async make() {
    if (this.busy) return;
    this.busy = true;
    const run = this.run;
    this.error = '';
    try {
      const { canMakeVideo, makeVideo } = await import('../lib/video/encode');
      if (!this.audio) {
        this.loading = true;
        const { decode, rebuildSource } = await import('../lib/video/rebuild');
        const { raw, loop } = await decode(this.voxUrl, this.mix.file);
        const src = await rebuildSource(this.mix.recipe, this.instrument, raw, loop);
        this.audio = src.fullAudio;
        this.script = buildScript(src, this.mix.title);
        this.loading = false;
      }
      await document.fonts.load(`700 30px 'Courier Prime'`).catch(() => {});
      for (;;) {
        if (run !== this.run) return;
        const shape = this.shape;
        if (this.videos[shape]) return;
        this.ok[shape] ??= await canMakeVideo(shape).catch(() => false);
        if (!this.ok[shape]) return;
        this.progress[shape] = 0;
        const blob = await makeVideo(this.script!, this.sprout, shape, this.audio!, {
          progress: (p) => run === this.run && (this.progress[shape] = p),
          cancelled: () => run !== this.run,
        });
        if (run !== this.run) return;
        this.videos = { ...this.videos, [shape]: { blob, url: URL.createObjectURL(blob) } };
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError' && run === this.run) {
        console.warn('video:', e);
        this.error = `Couldn't make the video (${(e as Error).message}).`;
      }
    } finally {
      this.loading = false;
      this.busy = false;
    }
  }

  /** Stop making (the page or the sheet closed); what's made is kept. */
  stop() {
    this.run++;
  }

  /** Let go of everything. */
  dispose() {
    this.stop();
    for (const v of Object.values(this.videos)) if (v) URL.revokeObjectURL(v.url);
    this.videos = {};
  }

  fileName(shape: Shape) {
    const slug = this.mix.title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return `beatvox-${slug || 'beat'}-${this.mix.id}${shape === 'tall' ? '-tall' : ''}.mp4`;
  }

  caption() {
    return `“${this.mix.title}”: a voice turned into a beat. Hear it on the map and make your own: ${beatvoxShareUrl(this.mix.id)} #beatvox`;
  }

  private file() {
    const v = this.videos[this.shape];
    return v && new File([v.blob], this.fileName(this.shape), { type: 'video/mp4' });
  }

  /** Can this device hand a video to its share sheet? */
  canShare() {
    if (typeof navigator.canShare !== 'function') return false;
    try {
      return navigator.canShare({ files: [new File([], 'beatvox.mp4', { type: 'video/mp4' })] });
    } catch {
      return false;
    }
  }

  /** Share the video (or save it, without a share sheet), and copy the caption. */
  async share() {
    const file = this.file();
    if (!file) return;
    const caption = this.caption();
    const copied = navigator.clipboard?.writeText(caption).then(
      () => true,
      () => false,
    );
    try {
      if (this.canShare()) {
        await navigator.share({ files: [file], title: this.mix.title, text: caption });
        rw.event('share_video', { data: `video ${this.shape} (share page)` });
      } else {
        this.download(file);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') this.error = `Couldn't share the video (${(e as Error).message}). Try saving it.`;
    }
    this.captionCopied = (await copied) ?? false;
  }

  save() {
    const file = this.file();
    if (file) this.download(file);
  }

  private download(file: File) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    rw.event('save_file', { data: `video ${this.shape} (share page)` });
  }
}
