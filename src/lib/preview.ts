// Link previews for a BeatVox's share page (/b/<id>). iMessage, WhatsApp,
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
  url: string;
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
    title: name ? `${name} · ${revox ? 'a reVox' : 'a BeatVox'}` : revox ? 'A reVox on BeatVox' : 'A BeatVox',
    description: revox
      ? 'A beat made from someone else’s voice. Hear it, then make your own on BeatVox.'
      : 'A beat made from one voice. Hear it, then make your own on BeatVox.',
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
          `<meta property="og:image:type" content="image/gif">`,
          `<meta property="og:image:width" content="1200">`,
          `<meta property="og:image:height" content="630">`,
          `<meta property="og:image:alt" content="${esc(m.title)}: the beat drawn as a ring">`,
          `<meta name="twitter:image" content="${esc(m.image)}">`,
        ]
      : []),
  ].join('\n    ');
  const titled = /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(m.title)}</title>`)
    : html.replace(/<head>/i, `<head>\n    <title>${esc(m.title)}</title>`);
  return titled.replace(/<\/head>/i, `    ${tags}\n  </head>`);
}
