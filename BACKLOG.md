# BeatVox Backlog

Ideas and requests not yet scheduled. See [PROPOSAL.md](PROPOSAL.md) for the plan and phases.

## Patterns and recipes

- [ ] **Undo for patterns.** An undo button that steps back through the last handful of beat states (e.g., 10), covering New Beat, Evolve and manual edits. Possibly redo too.
- [ ] **Save settings as a recipe.** A "save" button that stores the current beat as a recipe so a pattern you like isn't lost. The recipe holds: slices, patterns, voice/slice assignments, tempo, pitch, pan, effects and seed.
- [ ] **Re-load recipes.** A list of saved recipes to load back in, kept locally on the device. Also loadable from Roundware for shared ones.

## Sharing, reVox and storage

- [ ] **Each reVox is connected to its source.** Store the "reVoxed from" link (the source contribution's id), so the chain or family tree can be shown and walked in both directions.
- [ ] **Store the original and the BeatVoxes separately?** Upload the original voice once as its own asset, with each BeatVox mix as its own asset pointing back to it. One recording could then have many BeatVoxes, by its author or others via reVox. This fits the v3 mapping, where the voice is already a separate asset. Open question: does the shared MP3 still contain original + remix, or does the share page play the two parts from separate assets?

## Beat templates and drum roles

- [x] **Recipe format.** JSON with 16-character patterns in drum-machine notation (`x` hit, `X` accent, `o` ghost, `.` rest), per-voice role, optional slice, and tempo, swing, space and evolve settings. See `src/lib/recipe.ts`. Styles and saved beats share it.
- [~] **Style templates.** Started: a Style menu in Listen with v1.93 Groove, House, Boom Bap, Rock, Breakbeat, Dembow, Trap and Drum & Bass (`src/lib/styles.ts`). Still to do: jazz (needs triplet or 8th-note swing) and evolve rules per style. Original idea: starting-point beats for styles such as electronica, rock, jazz, hip-hop and four-on-the-floor house. Each template sets:
  - per-voice patterns and a drum role per voice;
  - tempo range, swing and effects preset;
  - how Evolve is allowed to change it, so a template keeps its feel.
- [x] **Guess which drum each slice suits.** Done in `src/lib/audio/drumRoles.ts`: styles deal slices by role, Evolve keeps role voices on good fits, drum roles get tighter gates, and the slicer lab shows each slice's role. Possible next: per-role tone shaping (low shelf on kicks). Original idea: Classify slices by sound and put them on matching voices in templates:
  - **kick:** low spectral centroid, energy below ~200 Hz, short (deep vowels, "b", "d", "oo");
  - **snare:** broadband and noisy mid-range with a sharp attack ("t", "k", "ch", "p");
  - **hi-hat:** high centroid, very noisy (high spectral flatness), very short (sibilants "s", "sh", "ts");
  - **tonal / other:** voiced, pitched slices for melodic or "lead" voices.

  Each slice gets scores for all roles, so a template can take the best kick, the two best hats, and so on. It could also shape slices to fit their role: shorter for hats, a low-shelf boost for kicks. Prototype in the slicer lab by showing the role per slice and letting you audition by role.

## Slicer UI

- [ ] **One waveform with a method dropdown.** Replace the lab's three stacked lanes with a single waveform and a "slice by" dropdown (Mixed default, Syllables, Attacks), to save screen space. Do this when the slicer moves into the app's Record tab.
