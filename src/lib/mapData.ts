// Everything the map shows, from Roundware's public endpoints: every mix
// (each BeatVox and each reVox) where its maker placed it, grouped into
// families by the vox they were made from; each vox's file (heard from a
// mix's details, never shown on the map); and the filters, from the
// project's "listen" tag groups like the Roundware web app's filter pane.
// Recipes, needed for the clock markers and rings, load afterwards.
import { RW_API, RW_PROJECT, RW_TAGS } from './roundware';
import { matchRecipes, type ListedAsset } from './shared';
import { parseRecipe, type Recipe } from './recipe';

export interface MapMix {
  id: number;
  voxId: number;
  title: string;
  file: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  revox: boolean;
  tags: number[];
}

export interface FilterItem {
  tagId: number;
  label: string;
}
export interface FilterGroup {
  name: string;
  items: FilterItem[];
}

export interface MapData {
  /** newest first */
  mixes: MapMix[];
  /** each vox's mixes, oldest (the original BeatVox) first */
  families: Map<number, MapMix[]>;
  voxFiles: Map<number, string>;
  filters: FilterGroup[];
  /** where each mix's recipe is, once matched */
  recipeUrls: Map<number, string>;
}

const MIX_TAGS: number[] = [RW_TAGS.mix, RW_TAGS.revoxMix];
const INTERNAL: number[] = [RW_TAGS.source, RW_TAGS.instrument, RW_TAGS.recipe, RW_TAGS.card];
/** friendlier names than the tags' descriptions */
const LABELS: Record<number, string> = {
  [RW_TAGS.mix]: 'Original BeatVoxes',
  [RW_TAGS.revoxMix]: 'ReVoxes',
  [RW_TAGS.revoxAllowed]: 'Can be reVoxed',
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

/** every page of an asset listing (the server gives at most 200 a page) */
async function listAll(api: string, query: string): Promise<ListedAsset[]> {
  const out: ListedAsset[] = [];
  let next: string | null = `${api}/assets/?${query}&paginate=true&page_size=200`;
  for (let pages = 0; next && pages < 50; pages++) {
    const page: { results: ListedAsset[]; next: string | null } = await getJson(next);
    out.push(...page.results);
    next = page.next;
  }
  return out;
}

interface RwTag {
  id: number;
  value: string;
  description: string;
}
interface RwUiGroup {
  ui_mode: string;
  header_text: string;
  name: string;
  active: boolean;
  ui_items: { tag_id: number; active: boolean; sort_index: number }[];
}

/** The filter pane: the project's listen groups (minus BeatVox's internal tags), plus reVox. */
export function buildFilters(tags: RwTag[], groups: RwUiGroup[]): FilterGroup[] {
  const known = new Map(tags.map((t) => [t.id, t]));
  const label = (id: number) => LABELS[id] ?? known.get(id)?.description ?? known.get(id)?.value ?? `tag ${id}`;
  const out: FilterGroup[] = [];
  const seen = new Set<number>();
  for (const g of groups.filter((x) => x.active && x.ui_mode === 'listen')) {
    const items = [...g.ui_items]
      .filter((i) => i.active && !INTERNAL.includes(i.tag_id) && known.has(i.tag_id))
      .sort((a, b) => a.sort_index - b.sort_index)
      .map((i) => i.tag_id);
    // BeatVox's two kinds of mix go together
    if (items.includes(RW_TAGS.revoxMix) && !items.includes(RW_TAGS.mix)) items.unshift(RW_TAGS.mix);
    if (!items.length) continue;
    items.forEach((t) => seen.add(t));
    out.push({ name: g.name === 'Type' ? 'KIND' : g.name.toUpperCase(), items: items.map((tagId) => ({ tagId, label: label(tagId) })) });
  }
  if (!seen.has(RW_TAGS.mix)) out.unshift({ name: 'KIND', items: MIX_TAGS.map((tagId) => ({ tagId, label: label(tagId) })) });
  if (known.has(RW_TAGS.revoxAllowed) && !seen.has(RW_TAGS.revoxAllowed)) {
    out.push({ name: 'REVOX', items: [{ tagId: RW_TAGS.revoxAllowed, label: label(RW_TAGS.revoxAllowed) }] });
  }
  return out;
}

/** Does a mix pass the chosen filters? Within a group any chosen tag will do; every group with a choice must match. */
export function passes(mix: MapMix, groups: FilterGroup[], chosen: Set<number>): boolean {
  return groups.every((g) => {
    const want = g.items.filter((i) => chosen.has(i.tagId));
    return !want.length || want.some((i) => mix.tags.includes(i.tagId));
  });
}

export async function loadMap(api = RW_API, project = RW_PROJECT): Promise<MapData> {
  const [audio, recipes, tags, groups] = await Promise.all([
    listAll(api, `project_id=${project}&media_type=audio`),
    listAll(api, `project_id=${project}&media_type=data&tag_ids=${RW_TAGS.recipe}`),
    getJson<RwTag[]>(`${api}/tags/?project_id=${project}`).catch(() => [] as RwTag[]),
    getJson<RwUiGroup[]>(`${api}/uigroups/?project_id=${project}`).catch(() => [] as RwUiGroup[]),
  ]);
  const voxFiles = new Map<number, string>();
  for (const a of audio) if (a.file && a.submitted && a.tag_ids.includes(RW_TAGS.source)) voxFiles.set(a.id, a.file);

  const mixes: MapMix[] = audio
    // live beats of live voices: deactivating a voice takes every beat made from it off the map
    .filter((a) => a.file && a.submitted && a.parent_asset_id !== null && voxFiles.has(a.parent_asset_id) && a.tag_ids.some((t) => MIX_TAGS.includes(t)))
    .map((a) => ({
      id: a.id,
      voxId: a.parent_asset_id!,
      title: a.description || 'A BeatVox',
      file: a.file!,
      latitude: a.latitude,
      longitude: a.longitude,
      createdAt: a.created_at,
      revox: a.tag_ids.includes(RW_TAGS.revoxMix),
      tags: a.tag_ids,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const families = new Map<number, MapMix[]>();
  for (const m of [...mixes].reverse()) {
    const f = families.get(m.voxId) ?? [];
    f.push(m);
    families.set(m.voxId, f);
  }

  // which recipe file goes with which mix, without fetching them yet; a
  // recipe's own mixAssetId isn't known until it's read, so this matches by
  // time (and loadRecipe checks the id it finds)
  const recipeUrls = new Map<number, string>();
  const byVox = new Map<number, ListedAsset[]>();
  for (const r of recipes) {
    if (!r.file || r.parent_asset_id === null) continue;
    byVox.set(r.parent_asset_id, [...(byVox.get(r.parent_asset_id) ?? []), r]);
  }
  for (const [vox, fam] of families) {
    const rs = byVox.get(vox) ?? [];
    const m = matchRecipes(
      fam.map((x) => ({ id: x.id, createdAt: x.createdAt })),
      rs.map((r) => ({ createdAt: r.created_at, recipe: { file: r.file! } as { file: string; mixAssetId?: number } })),
    );
    for (const [mixId, r] of m) recipeUrls.set(mixId, r.file);
  }

  return { mixes, families, voxFiles, filters: buildFilters(tags, groups), recipeUrls };
}

const recipeCache = new Map<string, Promise<Recipe | null>>();

/** A mix's recipe (fetched once). */
export function loadRecipe(url: string | undefined): Promise<Recipe | null> {
  if (!url) return Promise.resolve(null);
  let p = recipeCache.get(url);
  if (!p) {
    p = getJson(url)
      .then((j) => parseRecipe(JSON.stringify(j)))
      .catch(() => null);
    recipeCache.set(url, p);
  }
  return p;
}
