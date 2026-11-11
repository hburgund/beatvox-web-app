// Genre styles: one JSON file per style in src/styles/, listed in filename
// order (hence the 01-, 02- prefixes). A file is either one beat (a style
// recipe with its own voices) or a style with many beats: a `beats` list,
// each beat a name, its voices and any settings it changes from the file's
// (bpm, swing…). Picking the style plays one of its beats; NEW BEAT plays
// another. Every beat is checked with validateRecipe, the same check a
// participant's uploaded recipe gets; a broken file or beat is skipped with a
// console warning instead of breaking the app.

import { validateRecipe, type Recipe } from './recipe';

const files = import.meta.glob<unknown>('../styles/*.json', { eager: true, import: 'default' });

export interface StyleLoadError {
  file: string;
  message: string;
}

export interface Style {
  name: string;
  /** one or more beats; each is a whole style recipe, named after its beat */
  beats: Recipe[];
}

export const STYLE_ERRORS: StyleLoadError[] = [];

/** One style file's beats, each a complete recipe (the file's settings, then the beat's own). */
export function styleBeats(value: unknown): Recipe[] {
  const f = value as Recipe & { beats?: (Partial<Recipe> & { name: string })[] };
  if (!f || typeof f !== 'object') throw new Error('style must be an object');
  if (f.kind !== 'style') throw new Error(`kind is "${f.kind}", expected "style"`);
  if (f.beats === undefined) return [validateRecipe(f)];
  if (!Array.isArray(f.beats) || !f.beats.length) throw new Error('beats must be a list of at least one beat');
  const { beats, ...shared } = f;
  return beats.map((b, i) => {
    if (typeof b?.name !== 'string') throw new Error(`beat ${i + 1} needs a name`);
    try {
      return validateRecipe({ ...shared, ...b, kind: 'style' });
    } catch (e) {
      throw new Error(`beat "${b.name}": ${(e as Error).message}`);
    }
  });
}

export const STYLES: Style[] = Object.keys(files)
  .sort()
  .flatMap((path) => {
    const file = path.split('/').pop()!;
    try {
      const f = files[path] as { name?: unknown };
      if (typeof f?.name !== 'string') throw new Error('style needs a name');
      return [{ name: f.name, beats: styleBeats(f) }];
    } catch (e) {
      const message = (e as Error).message;
      STYLE_ERRORS.push({ file, message });
      console.warn(`BeatVox: skipped style ${file}: ${message}`);
      return [];
    }
  });

export const styleNamed = (name: string) => STYLES.find((s) => s.name === name);
