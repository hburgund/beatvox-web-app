// Load one shared BeatVox from Roundware for its share page: the mix (the
// looping beat), the recipe it was made from, the source vox, and the family
// of every beat made from the same vox. All of it is public: the share
// endpoint and the asset list need no sign-in.
//
// Roundware keeps a bundle one level deep, so the mix, the instrument and
// every recipe are all children of the vox. A recipe names its mix
// (mixAssetId) from Nov 2026 on; older ones are matched by time, since a
// recipe is always sent right after its mix.
import { parseRecipe, parsePattern, type Recipe, type Role } from './recipe';
import { RW_API, RW_PROJECT, RW_TAGS } from './roundware';
import { validateInstrument, type Instrument } from './instrument';

export interface SharedMix {
  id: number;
  title: string;
  file: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  recipe: Recipe | null;
}

export type Shared =
  | { status: 'pending' }
  | { status: 'missing' }
  | {
      status: 'live';
      mix: SharedMix;
      vox: { id: number; file: string; latitude: number; longitude: number };
      /** every beat made from this vox, oldest first (this one included) */
      family: SharedMix[];
      revoxAllowed: boolean;
      /** how the vox was cut, and its asset (what a reVox plays) */
      instrument: Instrument | null;
      instrumentAsset: number | null;
    };

/** an asset as the list returns it (the fields used here) */
export interface ListedAsset {
  id: number;
  parent_asset_id: number | null;
  media_type: string;
  tag_ids: number[];
  submitted: boolean;
  created_at: string;
  latitude: number;
  longitude: number;
  description: string;
  file: string | null;
}

const MIX_TAGS: number[] = [RW_TAGS.mix, RW_TAGS.revoxMix];

/**
 * Which recipe goes with which mix: by the mix id a recipe names, else the
 * first unclaimed recipe sent at or after the mix (and before the next mix).
 */
export function matchRecipes<R extends { mixAssetId?: number }>(
  mixes: { id: number; createdAt: string }[],
  recipes: { createdAt: string; recipe: R }[],
): Map<number, R> {
  const out = new Map<number, R>();
  const claimed = new Set<number>();
  recipes.forEach((r, i) => {
    if (r.recipe.mixAssetId !== undefined && mixes.some((m) => m.id === r.recipe.mixAssetId)) {
      out.set(r.recipe.mixAssetId, r.recipe);
      claimed.add(i);
    }
  });
  const byTime = [...mixes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  byTime.forEach((m, k) => {
    if (out.has(m.id)) return;
    const next = byTime[k + 1]?.createdAt;
    const i = recipes.findIndex(
      (r, j) => !claimed.has(j) && r.recipe.mixAssetId === undefined && r.createdAt >= m.createdAt && (!next || r.createdAt < next),
    );
    if (i >= 0) {
      out.set(m.id, recipes[i].recipe);
      claimed.add(i);
    }
  });
  return out;
}

/** One ring of the picture: a beat row's 16 steps and the sound its slice makes. */
export interface RingRow {
  hits: boolean[];
  on: boolean;
  sound: Role | undefined;
}

/** The recipe's 8 rows for the ring (missing rows are empty and resting). */
export function ringRows(recipe: Recipe | null): RingRow[] {
  return Array.from({ length: 8 }, (_, i) => {
    const v = recipe?.voices[i];
    if (!v) return { hits: Array(16).fill(false), on: false, sound: undefined };
    return { hits: parsePattern(v.pattern).hits, on: v.on !== false, sound: v.sliceRole ?? (v.role !== 'any' ? v.role : undefined) };
  });
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * The beat a link opens: the one it names, or for a link to the vox itself,
 * its first. A link to a beat that isn't live (deactivated) opens nothing,
 * not some other beat of the same voice.
 */
export function chooseMix<T extends { id: number }>(family: T[], id: number, voxId: number): T | null {
  return family.find((m) => m.id === id) ?? (id === voxId ? (family[0] ?? null) : null);
}

export async function loadShared(id: number, api = RW_API, project = RW_PROJECT): Promise<Shared> {
  let root: { status: string; id: number; file: string; latitude: number; longitude: number };
  try {
    root = await getJson(`${api}/assets/${id}/shared/?project_id=${project}`);
  } catch (e) {
    if ((e as Error).message === '404') return { status: 'missing' };
    throw e;
  }
  if (root.status !== 'live') return { status: 'pending' };

  // every child of the vox, 200 a page (the server's most)
  const kids: ListedAsset[] = [];
  let next: string | null = `${api}/assets/?project_id=${project}&parent_asset_id=${root.id}&paginate=true&page_size=200`;
  for (let pages = 0; next && pages < 20; pages++) {
    const page: { results: ListedAsset[]; next: string | null } = await getJson(next);
    kids.push(...page.results);
    next = page.next;
  }
  const mixAssets = kids.filter(
    // only live beats: a deactivated one is gone, even from its own link
    (a) => a.media_type === 'audio' && a.file && a.tag_ids.some((t) => MIX_TAGS.includes(t)) && a.submitted,
  );
  const recipeAssets = kids.filter((a) => a.media_type === 'data' && a.file && a.tag_ids.includes(RW_TAGS.recipe));
  const instrumentAsset = kids.find((a) => a.media_type === 'data' && a.file && a.tag_ids.includes(RW_TAGS.instrument));

  const [recipes, instrument] = await Promise.all([
    Promise.all(
      recipeAssets.map(async (a) => {
        try {
          const recipe = parseRecipe(JSON.stringify(await getJson(a.file!)));
          return { createdAt: a.created_at, recipe };
        } catch {
          return null;
        }
      }),
    ),
    instrumentAsset
      ? getJson(instrumentAsset.file!)
          .then(validateInstrument)
          .catch(() => null)
      : null,
  ]);
  const mixesBase = mixAssets.map((a) => ({ id: a.id, createdAt: a.created_at }));
  const matched = matchRecipes(mixesBase, recipes.filter((r) => r !== null));

  const family: SharedMix[] = mixAssets
    .map((a) => ({
      id: a.id,
      title: a.description || 'A BeatVox',
      file: a.file!,
      latitude: a.latitude,
      longitude: a.longitude,
      createdAt: a.created_at,
      recipe: matched.get(a.id) ?? null,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const mix = chooseMix(family, id, root.id);
  if (!mix) return { status: 'missing' };
  return {
    status: 'live',
    mix,
    vox: { id: root.id, file: root.file, latitude: root.latitude, longitude: root.longitude },
    family,
    revoxAllowed: instrument?.revoxAllowed === true,
    instrument,
    instrumentAsset: instrument ? instrumentAsset!.id : null,
  };
}
