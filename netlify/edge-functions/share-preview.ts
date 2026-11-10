// Netlify Edge Function: a BeatVox share page (/b/<id>) with its link
// preview filled in — title, a line about it, and its animated share card —
// for the apps that read a link's <head> without running the app. Anything
// that goes wrong serves the page as it is: a preview is never worth a
// broken page. The work is in src/lib/preview.ts (tested there).
import { injectMeta, previewFor } from '../../src/lib/preview.ts';

interface Context {
  next: () => Promise<Response>;
}

export default async (req: Request, context: Context) => {
  const res = await context.next();
  const m = /^\/b\/(\d+)\/?$/.exec(new URL(req.url).pathname);
  if (!m || !(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  try {
    // Roundware slow or away: give up after a few seconds and serve the page
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const meta = await previewFor(Number(m[1]), req.url, (url) => fetch(url, { signal: ctl.signal })).finally(() => clearTimeout(timer));
    if (!meta) return res;
    const html = injectMeta(await res.text(), meta);
    const headers = new Headers(res.headers);
    headers.delete('content-length');
    // previews change rarely; let Netlify's CDN keep this a little while
    headers.set('cache-control', 'public, max-age=0, must-revalidate');
    headers.set('netlify-cdn-cache-control', 'public, max-age=300');
    return new Response(html, { status: res.status, headers });
  } catch {
    return res;
  }
};

export const config = { path: '/b/*' };
