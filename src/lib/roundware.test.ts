import { afterEach, describe, expect, it, vi } from 'vitest';
import { Roundware, RW_TAGS } from './roundware';
import { encodeWav } from './audio/wav';

describe('encodeWav', () => {
  it('writes a 16-bit PCM header and clipped samples', async () => {
    const d = new Float32Array([0, 1, -1, 2]);
    const buf = { numberOfChannels: 1, length: 4, sampleRate: 48000, getChannelData: () => d } as unknown as AudioBuffer;
    const v = new DataView(await encodeWav(buf).arrayBuffer());
    expect(v.byteLength).toBe(44 + 8);
    expect(v.getUint32(24, true)).toBe(48000);
    expect(v.getUint16(34, true)).toBe(16);
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767]);
  });
});

describe('Roundware', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('makes a participant and session once, then uploads with the token', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    let next = 500;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const body = url.endsWith('/participants/')
        ? { id: 7, participant_token: 'tok' }
        : url.endsWith('/sessions/')
          ? { id: 9 }
          : { id: next++, file: 'https://cdn/x', submitted: true };
      return new Response(JSON.stringify(body), { status: 201 });
    });
    const rw = new Roundware(() => 'dev-1', 'https://rw.test/api/3', 103);
    const place = { latitude: 1.5, longitude: -2 };
    const a = await rw.upload({ mediaType: 'audio', file: new Blob(['x']), fileName: 'v.wav', place, tags: [RW_TAGS.source] });
    const b = await rw.upload({ mediaType: 'data', file: new Blob(['{}']), fileName: 'i.json', place, tags: [RW_TAGS.instrument], parent: a.id });
    expect([a.id, b.id]).toEqual([500, 501]);
    expect(calls.map((c) => c.url.replace('https://rw.test/api/3', ''))).toEqual(['/participants/', '/sessions/', '/assets/', '/assets/']);
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ project_id: 103, device_id: 'dev-1', client_type: 'web' });
    expect(JSON.parse(calls[1].init.body as string)).not.toHaveProperty('timezone');
    const f = calls[3].init.body as FormData;
    expect((calls[3].init.headers as Record<string, string>)['X-Participant-Token']).toBe('tok');
    expect(f.get('session_id')).toBe('9');
    expect(f.get('parent_asset_id')).toBe('500');
    expect(f.get('tag_ids')).toBe(String(RW_TAGS.instrument));
    expect((f.get('file') as File).name).toBe('i.json');
  });

  it('reports the server detail, and an asset saved without its file', async () => {
    let n = 0;
    vi.stubGlobal('fetch', async () => {
      n++;
      if (n === 1) return new Response(JSON.stringify({ id: 1, participant_token: 't' }));
      if (n === 2) return new Response(JSON.stringify({ id: 2 }));
      if (n === 3) return new Response(JSON.stringify({ detail: 'bad tag' }), { status: 422 });
      return new Response(JSON.stringify({ id: 3, file: null }));
    });
    const rw = new Roundware(() => 'd', 'https://rw.test', 1);
    const up = () => rw.upload({ mediaType: 'audio', file: new Blob(['x']), fileName: 'a.wav', place: { latitude: 0, longitude: 0 }, tags: [1] });
    await expect(up()).rejects.toThrow('Roundware said 422: bad tag');
    await expect(up()).rejects.toThrow('without its file');
  });
});
