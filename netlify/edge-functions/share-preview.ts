// Netlify Edge Function: link previews for the apps that read a page's <head>
// without running the app. A BeatVox share page (/b/<id>) gets its title, a
// line about it and its animated share card; the map, the studio and About
// get the site's card. Anything
// that goes wrong serves the page as it is: a preview is never worth a
// broken page. The work is in src/lib/preview.ts (tested there).
// It also counts the page view in GoatCounter (src/lib/count.ts), after the
// page is on its way.
import { injectMeta, previewFor, sitePreview } from '../../src/lib/preview.ts';
import { pageHit, sendHits } from '../../src/lib/count.ts';

declare const Netlify: { env: { get(key: string): string | undefined } };

interface Context {
  next: () => Promise<Response>;
  ip?: string;
  geo?: { country?: { code?: string } };
  waitUntil?: (p: Promise<unknown>) => void;
}

function countView(req: Request, context: Context) {
  try {
    const hit = pageHit(req, { ip: context.ip, country: context.geo?.country?.code });
    if (!hit) return;
    const sent = sendHits({ site: Netlify.env.get('GOATCOUNTER_SITE'), token: Netlify.env.get('GOATCOUNTER_TOKEN') }, [hit]);
    if (context.waitUntil) context.waitUntil(sent);
    else void sent;
  } catch {
    /* counting is never worth a broken page */
  }
}

export default async (req: Request, context: Context) => {
  const res = await context.next();
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
  if (res.ok) countView(req, context);
  const m = /^\/b\/(\d+)\/?$/.exec(new URL(req.url).pathname);
  if (!m) {
    const site = sitePreview(req.url);
    if (!site) return res;
    try {
      const headers = new Headers(res.headers);
      headers.delete('content-length');
      return new Response(injectMeta(await res.text(), site), { status: res.status, headers });
    } catch {
      return res;
    }
  }
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

export const config = { path: ['/', '/studio', '/about', '/b/*'] };
