// Visit counts in GoatCounter, sent from our own server so the page loads no
// third-party script and sets no cookie. Two kinds of hit:
//  - page views, counted by the edge function that already runs on each page
//    (netlify/edge-functions/share-preview.ts);
//  - the moments that matter (a voice recorded, 8 bars saved, sent to the
//    map, shared...), which the page sends to its own /api/count
//    (netlify/edge-functions/count.ts), which passes them on.
// Both need GOATCOUNTER_SITE (the site code, as in <code>.goatcounter.com)
// and GOATCOUNTER_TOKEN (an API key) in Netlify's environment; without
// them nothing is sent. Shared by the page and the edge functions, so
// nothing here uses the DOM or Deno.

export interface Hit {
  path: string;
  title?: string;
  event?: boolean;
  ref?: string;
  query?: string;
  user_agent?: string;
  ip?: string;
  location?: string;
}

/** What the edge function knows about the visitor. */
export interface Visitor {
  ip?: string;
  country?: string;
}

/** Crawlers, link-preview fetchers (the share cards) and scripts. */
const BOT =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|skype|vkshare|pinterest|bitly|outbrain|quora|lighthouse|headless|phantom|curl|wget|python|httpclient|axios|node-fetch|go-http|java\//i;

export function isBot(ua: string | null | undefined): boolean {
  return !ua || BOT.test(ua);
}

/** A prefetch or prerender, not someone looking at the page. */
export function isPrefetch(req: Request): boolean {
  const p = `${req.headers.get('purpose') ?? ''} ${req.headers.get('sec-purpose') ?? ''} ${req.headers.get('x-moz') ?? ''}`;
  return /prefetch|prerender/i.test(p);
}

const PAGE_TITLES: Record<string, string> = { '/': 'Map', '/studio': 'Studio', '/about': 'About' };

/** Campaign parameters only: a reVox id or the like isn't a source. */
function campaign(url: URL): string | undefined {
  const keep = [...url.searchParams].filter(([k]) => /^(utm_[a-z]+|ref)$/i.test(k));
  return keep.length ? '?' + new URLSearchParams(keep).toString() : undefined;
}

/** Where they came from, if it's another site. */
function referrer(req: Request, url: URL): string | undefined {
  const ref = req.headers.get('referer');
  if (!ref) return undefined;
  try {
    return new URL(ref).host === url.host ? undefined : ref;
  } catch {
    return undefined;
  }
}

function who(req: Request, v: Visitor): Pick<Hit, 'user_agent' | 'ip' | 'location'> {
  return {
    user_agent: req.headers.get('user-agent') ?? undefined,
    ip: v.ip,
    location: v.country,
  };
}

/** A page view, or null for a bot, a prefetch or anything but a page load. */
export function pageHit(req: Request, v: Visitor = {}): Hit | null {
  if (req.method !== 'GET' || isPrefetch(req) || isBot(req.headers.get('user-agent'))) return null;
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const title = /^\/b\/\d+$/.test(path) ? 'Share page' : PAGE_TITLES[path];
  if (!title) return null;
  return { path, title, ref: referrer(req, url), query: campaign(url), ...who(req, v) };
}

/** The only event names /api/count passes on. */
const EVENTS =
  /^(voice-recorded|8-bars-saved|saved-[a-z0-9-]{1,24}|shared-[a-z0-9-]{1,32}|sent-to-map(-revox)?|revox-started|wander-started)$/;

export function allowedEvent(name: string): boolean {
  return EVENTS.test(name);
}

/** An event sent to /api/count, or null if it isn't one of ours or isn't from a person. */
export function eventHit(req: Request, name: string, v: Visitor = {}): Hit | null {
  if (!allowedEvent(name) || isBot(req.headers.get('user-agent'))) return null;
  return { path: name, event: true, ...who(req, v) };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * The GoatCounter event for one of the Roundware events the app logs, or
 * null for the ones not counted there (they stay in Roundware).
 */
export function goatEvent(type: string, data?: string): string | null {
  switch (type) {
    case 'end_record':
      return 'voice-recorded';
    case 'save_loop':
      return '8-bars-saved';
    case 'save_file':
      return data ? `saved-${slug(data)}` : null; // mp3, mp3 loop, gif, video <shape>
    case 'share_video':
      return data ? `shared-${slug(data)}` : 'shared-video'; // video <shape>
    case 'share_map': {
      // "url: ... (studio|share page, share sheet|copied)"
      const m = /\(([^,]+),\s*([^)]+)\)\s*$/.exec(data ?? '');
      return m ? `shared-link-${slug(m[1])}-${/copied/.test(m[2]) ? 'copied' : 'sheet'}` : 'shared-link';
    }
    case 'send_to_map':
      return / revox of /.test(data ?? '') ? 'sent-to-map-revox' : 'sent-to-map';
    case 'start_revox':
      return 'revox-started';
    case 'play_stream':
      return 'wander-started';
    default:
      return null;
  }
}

export interface GoatConfig {
  site?: string;
  token?: string;
}

/**
 * Send hits to GoatCounter; never throws. What happened: `sent`, `off`
 * (not configured, or nothing to send), `http <status>` or `error <message>`,
 * for the edge functions' logs.
 */
export async function sendHits(
  cfg: GoatConfig,
  hits: Hit[],
  fetcher: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<string> {
  if (!cfg.site || !cfg.token || !hits.length) return 'off';
  try {
    const res = await fetcher(`https://${cfg.site.trim()}.goatcounter.com/api/v0/count`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token.trim()}` },
      body: JSON.stringify({ no_sessions: true, hits }),
    });
    if (res.ok) return 'sent';
    const why = (await res.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ');
    return `http ${res.status}${why ? ` ${why}` : ''}`;
  } catch (e) {
    return `error ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** From the page: count one of the app's events (production only). */
export function countEvent(type: string, data?: string, mode: 'send' | 'console' | 'off' = 'send') {
  const name = goatEvent(type, data);
  if (!name || mode === 'off') return;
  if (mode === 'console') return console.info('[goatcounter] event', name);
  try {
    if (!navigator.sendBeacon?.('/api/count', name)) {
      void fetch('/api/count', { method: 'POST', body: name, keepalive: true }).catch(() => {});
    }
  } catch {
    /* counting is never worth an error */
  }
}
