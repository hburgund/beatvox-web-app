import { describe, it, expect } from 'vitest';
import { injectMeta, previewFor } from './preview';

const API = 'https://api.test/api/3';
const page = '<!doctype html><html><head><meta charset="UTF-8"><title>BeatVox</title></head><body></body></html>';

function fakeFetch(routes: Record<string, unknown>) {
  return async (url: string) => {
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    return key ? new Response(JSON.stringify(routes[key]), { status: 200 }) : new Response('{}', { status: 404 });
  };
}

const list = {
  results: [
    { id: 11, media_type: 'audio', tag_ids: [1128], description: 'Morning Kettle', file: 'm.mp3', created_at: '2026-11-09T10:00:00Z' },
    { id: 12, media_type: 'data', tag_ids: [1127], description: '', file: 'https://cdn/r11.json', created_at: '2026-11-09T10:00:05Z' },
    { id: 21, media_type: 'audio', tag_ids: [1125, 1129], description: 'Steam Trap', file: 'r.mp3', created_at: '2026-11-09T12:00:00Z' },
    { id: 22, media_type: 'data', tag_ids: [1127], description: '', file: 'https://cdn/r21.json', created_at: '2026-11-09T12:00:05Z' },
  ],
};
const routes = {
  [`${API}/assets/11/shared/`]: { status: 'live', id: 10 },
  [`${API}/assets/21/shared/`]: { status: 'live', id: 10 },
  [`${API}/assets/99/shared/`]: { status: 'pending' },
  [`${API}/assets/?project_id=103&parent_asset_id=10`]: list,
  'https://cdn/r11.json': { mixAssetId: 11, cardUrl: 'https://cdn/card11.gif' },
  'https://cdn/r21.json': { mixAssetId: 21 },
};

describe('previewFor', () => {
  it('names the beat and finds its card through its recipe', async () => {
    const m = await previewFor(11, 'https://bv.test/b/11', fakeFetch(routes), API);
    expect(m?.title).toBe('Morning Kettle · a BeatVox');
    expect(m?.image).toBe('https://cdn/card11.gif');
    expect(m?.url).toBe('https://bv.test/b/11');
  });

  it('says reVox, and has no picture when its recipe names none', async () => {
    const m = await previewFor(21, 'https://bv.test/b/21', fakeFetch(routes), API);
    expect(m?.title).toBe('Steam Trap · a reVox');
    expect(m?.image).toBeUndefined();
  });

  it('calls an untitled one just "A BeatVox"', async () => {
    const r = { ...routes, [`${API}/assets/?project_id=103&parent_asset_id=10`]: { results: list.results.map((x) => ({ ...x, description: '' })) } };
    expect((await previewFor(11, 'u', fakeFetch(r), API))?.title).toBe('A BeatVox');
  });

  it('gives nothing for a BeatVox that is not live', async () => {
    expect(await previewFor(99, 'https://bv.test/b/99', fakeFetch(routes), API)).toBeNull();
  });
});

describe('injectMeta', () => {
  it('sets the title and adds the preview tags, escaped', () => {
    const html = injectMeta(page, { title: 'Tea & "Toast" · a BeatVox', description: 'x', image: 'https://cdn/c.gif', url: 'https://bv.test/b/1' });
    expect(html).toContain('<title>Tea &amp; &quot;Toast&quot; · a BeatVox</title>');
    expect(html).toContain('<meta property="og:image" content="https://cdn/c.gif">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html.indexOf('og:title')).toBeLessThan(html.indexOf('</head>'));
  });

  it('uses a plain card without a picture', () => {
    const html = injectMeta(page, { title: 't', description: 'd', url: 'u' });
    expect(html).not.toContain('og:image');
    expect(html).toContain('content="summary"');
  });
});
