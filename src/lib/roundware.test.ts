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

describe('Roundware usage logging', () => {
  afterEach(() => vi.unstubAllGlobals());

  function server() {
    const calls: { method: string; path: string; body: Record<string, unknown>; keepalive?: boolean }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const path = url.replace('https://rw.test', '');
      calls.push({ method: init.method!, path, body: JSON.parse((init.body as string) ?? '{}'), keepalive: init.keepalive });
      const body = path === '/participants/' ? { id: 7, participant_token: 'tok' } : path === '/sessions/' ? { id: 9 } : { id: 40 };
      return new Response(JSON.stringify(body), { status: 201 });
    });
    return calls;
  }
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('starts a session, logs events, and a listen with its duration', async () => {
    const calls = server();
    const rw = new Roundware(() => 'd', 'https://rw.test', 103, 'send');
    rw.startVisit();
    rw.startVisit();
    rw.hear(55);
    rw.hear(55);
    await settle();
    rw.unhear(55);
    rw.event('filter_stream', { tags: '3,5' });
    await settle();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /participants/',
      'POST /sessions/',
      'POST /events/',
      'POST /listeninghistoryitems/',
      'PATCH /listeninghistoryitems/40/',
      'POST /events/',
    ]);
    expect(calls[2].body).toMatchObject({ session_id: 9, event_type: 'start_session' });
    expect(calls[3].body).toMatchObject({ session_id: 9, asset_id: 55 });
    expect(typeof calls[4].body.duration_sec).toBe('number');
    expect(calls[5].body).toMatchObject({ event_type: 'filter_stream', tags: '3,5' });
  });

  it('closes open listens with keepalive when the page goes', async () => {
    const calls = server();
    const on: Record<string, () => void> = {};
    vi.stubGlobal('addEventListener', (type: string, f: () => void) => (on[type] = f));
    const rw = new Roundware(() => 'd', 'https://rw.test', 103, 'send');
    rw.startVisit();
    rw.hear(55);
    await settle();
    on.pagehide();
    await settle();
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', path: '/listeninghistoryitems/40/', keepalive: true });
  });

  it('sends nothing when off, and never throws when Roundware fails', async () => {
    const calls = server();
    const off = new Roundware(() => 'd', 'https://rw.test', 103);
    off.startVisit();
    off.hear(1);
    off.event('x');
    await settle();
    expect(calls).toEqual([]);
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 500 }));
    const rw = new Roundware(() => 'd', 'https://rw.test', 103, 'send');
    rw.event('x');
    rw.hear(1);
    rw.unhear(1);
    await settle();
  });

  it('carries a session on across page loads in the tab, until it goes idle', async () => {
    const calls = server();
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const load = async () => {
      const rw = new Roundware(() => 'd', 'https://rw.test', 103, 'send');
      rw.startVisit();
      await settle();
      return rw;
    };
    await load();
    now += 20 * 60 * 1000;
    const second = await load();
    expect(calls.filter((c) => c.path === '/sessions/')).toHaveLength(1);
    expect(calls.filter((c) => c.body.event_type === 'start_session')).toHaveLength(1);
    second.event('x');
    await settle();
    expect(calls.at(-1)).toMatchObject({ path: '/events/', body: { session_id: 9 }, method: 'POST' });
    expect(calls.at(-1)!.body).not.toHaveProperty('event_type', 'start_session');
    now += 31 * 60 * 1000;
    second.event('y');
    await settle();
    expect(calls.filter((c) => c.path === '/sessions/')).toHaveLength(2);
    expect(calls.filter((c) => c.body.event_type === 'start_session')).toHaveLength(2);
    vi.restoreAllMocks();
  });
});
