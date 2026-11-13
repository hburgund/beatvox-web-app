// /api/count: the page's events (a voice recorded, 8 bars saved, sent to the
// map, shared...) passed on to GoatCounter from here, so the page talks only
// to its own site. The body is the event's name; only BeatVox's own names,
// from its own pages, are passed on. See src/lib/count.ts.
import { eventHit, sendHits } from '../../src/lib/count.ts';

declare const Netlify: { env: { get(key: string): string | undefined } };

interface Context {
  ip?: string;
  geo?: { country?: { code?: string } };
  waitUntil?: (p: Promise<unknown>) => void;
}

/** From one of our pages: same origin, by the browser's word or the Origin header. */
function ours(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = req.headers.get('origin');
  try {
    return !!origin && new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
  if (!ours(req)) return new Response(null, { status: 403 });
  try {
    const name = (await req.text()).trim().slice(0, 64);
    const hit = eventHit(req, name, { ip: context.ip, country: context.geo?.country?.code });
    if (hit) {
      const sent = sendHits({ site: Netlify.env.get('GOATCOUNTER_SITE'), token: Netlify.env.get('GOATCOUNTER_TOKEN') }, [hit]);
      if (context.waitUntil) context.waitUntil(sent);
      else await sent;
    }
  } catch {
    /* nothing to tell the page */
  }
  return new Response(null, { status: 204 });
};

export const config = { path: '/api/count' };
