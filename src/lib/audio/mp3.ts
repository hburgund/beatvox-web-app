// MP3 encoding for the shared file, in a background worker.

/** Encode an AudioBuffer to an MP3 Blob. */
export function encodeMp3(audio: AudioBuffer): Promise<Blob> {
  const channels = Array.from({ length: Math.min(2, audio.numberOfChannels) }, (_, c) => audio.getChannelData(c).slice());
  const worker = new Worker(new URL('./mp3.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<Blob>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ bytes?: Uint8Array; error?: string }>) => {
      worker.terminate();
      if (e.data.bytes) resolve(new Blob([e.data.bytes as BlobPart], { type: 'audio/mpeg' }));
      else reject(new Error(e.data.error ?? 'MP3 encoding failed'));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'MP3 encoding failed'));
    };
    worker.postMessage({ channels, sampleRate: audio.sampleRate }, channels.map((c) => c.buffer));
  });
}
