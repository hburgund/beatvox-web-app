// A BeatVox video as an MP4 (H.264 and AAC, what every social app takes),
// made in the browser: each frame drawn off-screen, the phone's own video
// encoder (WebCodecs) doing the work, through Mediabunny. Browsers without an
// AAC encoder get a small WASM one. Nothing goes to a server.
import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_MEDIUM, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import { drawFrame, VIDEO_SIZE, type Shape, type Sprout } from './draw';
import type { VideoScript } from './script';

export const FPS = 30;

let aacReady: Promise<boolean> | null = null;

/** Can this browser make the MP4? (Checked once per shape; it never asks the user anything.) */
export async function canMakeVideo(shape: Shape): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  const { width, height } = VIDEO_SIZE[shape];
  const [video, audio] = await Promise.all([canEncodeVideo('avc', { width, height, quality: QUALITY_MEDIUM, frameRate: FPS }), aac()]);
  return video && audio;
}

function aac() {
  aacReady ??= (async () => {
    if (await canEncodeAudio('aac')) return true;
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
    registerAacEncoder();
    return canEncodeAudio('aac');
  })().catch(() => false);
  return aacReady;
}

/**
 * Make the video. `progress` gets 0..1 as frames go in; `cancelled` is asked
 * every frame, and a cancelled video throws (name 'AbortError').
 */
export async function makeVideo(
  sc: VideoScript,
  sprout: Sprout,
  shape: Shape,
  audio: AudioBuffer,
  { progress, cancelled }: { progress?: (p: number) => void; cancelled?: () => boolean } = {},
): Promise<Blob> {
  const { width, height } = VIDEO_SIZE[shape];
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
  const g = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const video = new CanvasSource(canvas, { codec: 'avc', quality: QUALITY_MEDIUM });
  const sound = new AudioBufferSource({ codec: 'aac', quality: QUALITY_MEDIUM });
  output.addVideoTrack(video, { frameRate: FPS });
  output.addAudioTrack(sound);
  await output.start();
  const abort = async () => {
    await output.cancel();
    throw new DOMException('cancelled', 'AbortError');
  };
  try {
    await sound.add(trim(audio, sc.length));
    const frames = Math.ceil(sc.length * FPS);
    for (let i = 0; i < frames; i++) {
      if (cancelled?.()) return await abort();
      drawFrame(g, sc, sprout, i / FPS, shape);
      await video.add(i / FPS, 1 / FPS);
      if (i % 15 === 0) {
        progress?.(i / frames);
        // let the page breathe (taps, the preview) between bursts of frames
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    await output.finalize();
  } catch (e) {
    if (output.state !== 'canceled' && output.state !== 'finalized') await output.cancel().catch(() => {});
    throw e;
  }
  progress?.(1);
  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}

/** The soundtrack, cut at the video's end if it runs longer. */
function trim(audio: AudioBuffer, length: number): AudioBuffer {
  const n = Math.min(audio.length, Math.ceil(length * audio.sampleRate));
  if (n === audio.length) return audio;
  const out = new AudioBuffer({ length: n, numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate });
  for (let c = 0; c < audio.numberOfChannels; c++) out.copyToChannel(audio.getChannelData(c).subarray(0, n), c);
  return out;
}
