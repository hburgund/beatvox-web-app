// Link previews for BeatVox's pages: the map, the studio and About get the
// site's card (sitePreview); a BeatVox's share page (/b/<id>) gets its own.
// iMessage, WhatsApp,
// Slack and the like don't run the app; they read the page's <head>. The
// Netlify Edge Function (netlify/edge-functions/share-preview.ts) uses these
// to fill it in: the title, a line about it, and its share card (the
// animated ring GIF the studio uploaded with it).
//
// No imports: this runs in the edge function (Deno) as well as in tests.

export interface PreviewMeta {
  title: string;
  description: string;
  /** the share card, or nothing (older BeatVoxes have none) */
  image?: string;
  /** default: a BeatVox's ring GIF */
  imageType?: string;
  imageAlt?: string;
  url: string;
}

/** The site's own card, drawn by dev/og-card.html. */
export const SITE_CARD = '/og/beatvox.png';

const SITE_PAGES: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'BeatVox: putting rhythm into your voice',
    description: 'Explore the globe filled with beats made from people’s voices. Then create and contribute your own.',
  },
  '/studio': {
    title: 'Make a BeatVox',
    description: 'Record anything for up to 15 seconds and BeatVox slices it into a beat. Refine your creation, share it and add it to the map.',
  },
  '/about': {
    title: 'About BeatVox',
    description: 'What is BeatVox? How does it work and who made it?',
  },
};

/** The preview for one of the site's own pages (not a share page), or null. */
export function sitePreview(pageUrl: string): PreviewMeta | null {
  const u = new URL(pageUrl);
  const path = u.pathname.replace(/\/+$/, '') || '/';
  const page = SITE_PAGES[path];
  if (!page) return null;
  return {
    ...page,
    image: `${u.origin}${SITE_CARD}`,
    imageType: 'image/png',
    imageAlt: 'BeatVox: a beat grid and a yellow play button',
    // the address without ?revox= and the like, so every share of a page is one link
    url: `${u.origin}${path}`,
  };
}

const MIX = 1128;
const REVOX_MIX = 1125;
const RECIPE = 1127;

interface Listed {
  id: number;
  media_type: string;
  tag_ids: number[];
  description: string;
  file: string | null;
  created_at: string;
}

type Fetch = (url: string) => Promise<Response>;

async function json<T>(f: Fetch, url: string): Promise<T | null> {
  const r = await f(url);
  return r.ok ? ((await r.json()) as T) : null;
}

/** What a share page's preview says, from Roundware's public endpoints; null if it isn't live. */
export async function previewFor(id: number, pageUrl: string, f: Fetch, api = 'https://api.roundware.app/api/3', project = 103): Promise<PreviewMeta | null> {
  const root = await json<{ status: string; id: number }>(f, `${api}/assets/${id}/shared/?project_id=${project}`);
  if (!root || root.status !== 'live') return null;
  const list = await json<{ results: Listed[] }>(f, `${api}/assets/?project_id=${project}&parent_asset_id=${root.id}&paginate=true&page_size=200`);
  const kids = list?.results ?? [];
  const mixes = kids.filter((a) => a.media_type === 'audio' && a.tag_ids.some((t) => t === MIX || t === REVOX_MIX));
  // a link to the vox itself shows its first beat
  const mix = mixes.find((m) => m.id === id) ?? [...mixes].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  if (!mix) return null;
  const revox = mix.tag_ids.includes(REVOX_MIX);
  // its recipe names it (mixAssetId) and the card (cardUrl); newest first, a few at most
  let image: string | undefined;
  const recipes = kids
    .filter((a) => a.media_type === 'data' && a.file && a.tag_ids.includes(RECIPE) && a.created_at >= mix.created_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, 6);
  for (const r of recipes) {
    const recipe = await json<{ mixAssetId?: number; cardUrl?: string }>(f, r.file!).catch(() => null);
    if (recipe?.mixAssetId === mix.id) {
      image = recipe.cardUrl || undefined;
      break;
    }
  }
  const name = mix.description.trim();
  return {
    // an untitled one is just "A BeatVox" (not "A BeatVox · a BeatVox")
    title: name ? `${name} · ${revox ? 'a reVox' : 'a BeatVox'}` : revox ? 'A reVox of BeatVox' : 'A BeatVox',
    description: 'A voice with rhythm added! Listen and make your own with BeatVox.',
    image,
    url: pageUrl,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The page with its <title> replaced and the preview tags added to <head>. */
export function injectMeta(html: string, m: PreviewMeta): string {
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="BeatVox">`,
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.description)}">`,
    `<meta property="og:url" content="${esc(m.url)}">`,
    `<meta name="description" content="${esc(m.description)}">`,
    `<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(m.title)}">`,
    `<meta name="twitter:description" content="${esc(m.description)}">`,
    ...(m.image
      ? [
          `<meta property="og:image" content="${esc(m.image)}">`,
          `<meta property="og:image:type" content="${esc(m.imageType ?? 'image/gif')}">`,
          `<meta property="og:image:width" content="1200">`,
          `<meta property="og:image:height" content="630">`,
          `<meta property="og:image:alt" content="${esc(m.imageAlt ?? `${m.title}: the beat drawn as a ring`)}">`,
          `<meta name="twitter:image" content="${esc(m.image)}">`,
        ]
      : []),
  ].join('\n    ');
  const titled = /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(m.title)}</title>`)
    : html.replace(/<head>/i, `<head>\n    <title>${esc(m.title)}</title>`);
  return titled.replace(/<\/head>/i, `    ${tags}\n  </head>`);
}
