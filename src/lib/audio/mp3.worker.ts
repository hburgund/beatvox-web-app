// Encodes MP3 off the main thread so the beat keeps playing smoothly.
import { createEncoder } from 'wasm-media-encoders';
import wasmUrl from 'wasm-media-encoders/wasm/mp3?url';
import { encodeWith } from './mp3Core';

export interface Mp3Job {
  channels: Float32Array[];
  sampleRate: number;
}

self.onmessage = async (e: MessageEvent<Mp3Job>) => {
  try {
    const encoder = await createEncoder('audio/mpeg', wasmUrl);
    const bytes = encodeWith(encoder, e.data.channels, e.data.sampleRate);
    (self as unknown as Worker).postMessage({ bytes }, [bytes.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ error: (err as Error).message });
  }
};
