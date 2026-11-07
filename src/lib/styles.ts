// Genre styles: starting-point beats, written as recipes.
// x = hit, X = accent, o = ghost note, . = rest; one character per 16th note.
// Slices are dealt at random for now; `role` is there for when slices get
// matched to drum roles (see BACKLOG.md).

import { RECIPE_FORMAT, RECIPE_VERSION, type Recipe, type RecipeVoice } from './recipe';

function style(name: string, opts: Omit<Recipe, 'format' | 'version' | 'name' | 'kind' | 'voices'>, voices: RecipeVoice[]): Recipe {
  return { format: RECIPE_FORMAT, version: RECIPE_VERSION, name, kind: 'style', evolve: { auto: false }, ...opts, voices };
}

export const STYLES: Recipe[] = [
  style('v1.93 Groove', { bpm: 89, space: 35, evolve: { auto: true, every: 3 } }, [
    { role: 'kick', pattern: '1001011000010111', velocity: 100 },
    { role: 'snare', pattern: '1000100010001000' },
    { role: 'hat', pattern: '1010101010101010', velocity: 70 },
    { role: 'tonal', pattern: '..x.......x..x..' },
  ]),
  style('House', { bpm: 124, swing: 0.05, space: 30 }, [
    { role: 'kick', pattern: 'X...X...X...X...', velocity: 108 },
    { role: 'snare', pattern: '....X.......X...', velocity: 95 },
    { role: 'hat', pattern: '..x...x...x...x.', velocity: 85 },
    { role: 'hat', pattern: 'oxoxoxoxoxoxoxox', velocity: 60 },
    { role: 'perc', pattern: '...x.....x.x....', velocity: 75 },
    { role: 'tonal', pattern: 'x.....x.....x...', velocity: 70 },
  ]),
  style('Boom Bap', { bpm: 90, swing: 0.16, space: 22 }, [
    { role: 'kick', pattern: 'X.....x...X.....', velocity: 108 },
    { role: 'snare', pattern: '....X.......X...', velocity: 104 },
    { role: 'hat', pattern: 'x.o.x.o.x.o.x.ox', velocity: 72 },
    { role: 'perc', pattern: '..........x....o', velocity: 70 },
    { role: 'tonal', pattern: 'x.......x.x.....', velocity: 75 },
  ]),
  style('Rock', { bpm: 112, space: 30 }, [
    { role: 'kick', pattern: 'X.......X.x.....', velocity: 108 },
    { role: 'snare', pattern: '....X.......X...', velocity: 106 },
    { role: 'hat', pattern: 'x.x.x.x.x.x.x.x.', velocity: 75 },
    { role: 'tonal', pattern: 'X...............', velocity: 90 },
  ]),
  style('Breakbeat', { bpm: 136, swing: 0.04, space: 25 }, [
    { role: 'kick', pattern: 'X.x.......xx....', velocity: 106 },
    { role: 'snare', pattern: '....X..o.o..X..o', velocity: 102 },
    { role: 'hat', pattern: 'x.x.x.x.x.x.x.x.', velocity: 70 },
    { role: 'perc', pattern: '.......x......x.', velocity: 70 },
  ]),
  style('Dembow', { bpm: 96, space: 25 }, [
    { role: 'kick', pattern: 'X...x...X...x...', velocity: 106 },
    { role: 'snare', pattern: '...X..x....X..x.', velocity: 98 },
    { role: 'hat', pattern: 'x.x.x.x.x.x.x.x.', velocity: 65 },
    { role: 'tonal', pattern: 'x.......x.......', velocity: 75 },
  ]),
  style('Trap', { bpm: 140, space: 30 }, [
    { role: 'kick', pattern: 'X.........x..x..', velocity: 108 },
    { role: 'snare', pattern: '........X.......', velocity: 104 },
    { role: 'hat', pattern: 'x.x.x.x.x.xxx.x.', velocity: 68 },
    { role: 'hat', pattern: '.............ooo', velocity: 60 },
    { role: 'tonal', pattern: 'X.....x.........', velocity: 85 },
  ]),
  style('Drum & Bass', { bpm: 172, space: 28 }, [
    { role: 'kick', pattern: 'X.........x.....', velocity: 108 },
    { role: 'snare', pattern: '....X.......X...', velocity: 104 },
    { role: 'hat', pattern: 'x.x.x.x.x.x.x.x.', velocity: 62 },
    { role: 'perc', pattern: '..x.......o...x.', velocity: 70 },
  ]),
];
