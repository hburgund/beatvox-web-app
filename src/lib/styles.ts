// Genre styles: one recipe JSON file per style in src/styles/.
// Files are listed in filename order (hence the 01-, 02- prefixes). Each one is
// checked with validateRecipe, the same check a participant's uploaded recipe
// gets; a broken file is skipped with a console warning instead of breaking
// the app.

import { validateRecipe, type Recipe } from './recipe';

const files = import.meta.glob<unknown>('../styles/*.json', { eager: true, import: 'default' });

export interface StyleLoadError {
  file: string;
  message: string;
}

export const STYLE_ERRORS: StyleLoadError[] = [];

export const STYLES: Recipe[] = Object.keys(files)
  .sort()
  .flatMap((path) => {
    const file = path.split('/').pop()!;
    try {
      const r = validateRecipe(files[path]);
      if (r.kind !== 'style') throw new Error(`kind is "${r.kind}", expected "style"`);
      return [r];
    } catch (e) {
      const message = (e as Error).message;
      STYLE_ERRORS.push({ file, message });
      console.warn(`BeatVox: skipped style ${file}: ${message}`);
      return [];
    }
  });
