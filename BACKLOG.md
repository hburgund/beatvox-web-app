# BeatVox Backlog

Ideas and requests not yet scheduled. See [PROPOSAL.md](PROPOSAL.md) for the plan and phases.

## Patterns and recipes

- [x] **Track level and humanize are separate.** Each voice has a steady `level` (0–1, 1 = natural) for the mix, and the v1.93 velocity walk is now a `humanize` multiplier on top (recipe-wide amount 0–1). Replaces the MIDI-style `velocity` 50–110/127, which drifted so far that a style's relative levels were lost within a few bars. A per-track level fader in Advanced mode can use it directly.
- [ ] **Undo for patterns.** An undo button that steps back through the last handful of beat states (e.g., 10), covering New Beat, Evolve and manual edits. Possibly redo too.
- [ ] **Save settings as a recipe.** A "save" button that stores the current beat as a recipe so a pattern you like isn't lost. The recipe holds: slices, patterns, voice/slice assignments, tempo, pitch, pan, effects and seed.
- [ ] **Re-load recipes.** A list of saved recipes to load back in, kept locally on the device. Also loadable from Roundware for shared ones.

## Sharing, reVox and storage

- [x] **Instruments and recipes are separate.** An instrument (`src/lib/instrument.ts`) is a voice and its exact slices with drum-role scores; a recipe is how it's played. A beat names its instrument; on another instrument it picks slices by role. A reVox is someone else's instrument played with your own beats.
- [ ] **reVox constellation on the map.** Every mix (the first BeatVox and all reVoxes) is a child of the same raw voice asset, so the Roundware map can draw each voice as a centre with its mixes connected to it, a constellation springing from one original recording. Needs the map client to draw parent → child lines (and possibly mixes placed where they were made, far from the voice).
- [ ] **Each reVox is connected to its source.** Store the "reVoxed from" link (the source contribution's id), so the chain or family tree can be shown and walked in both directions.
- [ ] **Loudness-normalize each voice (LUFS).** Today a recording is peak-normalized, so one loud plosive makes the whole voice quiet. Normalize to a loudness target with a peak ceiling, so every participant's instrument, reVoxes and MP3s in the Roundware stream sit at the same loudness. Fits Phase 2.
- [x] **Store the original and the BeatVoxes separately.** Built: raw voice → mix (and its recipe) and instrument as separate Roundware assets (PROPOSAL §6).

## Beat templates and drum roles

- [x] **Recipe format.** JSON with 16-character patterns in drum-machine notation (`x` hit, `X` accent, `o` ghost, `.` rest), per-voice role, optional slice, and tempo, swing, space and evolve settings. See `src/lib/recipe.ts`. Styles and saved beats share it.
- [~] **Style templates.** Started: a Style menu in Listen with v1.93 Groove, House, Boom Bap, Rock, Breakbeat, Dembow, Trap and Drum & Bass (`src/styles/*.json`). Still to do: jazz (needs triplet or 8th-note swing) and evolve rules per style. Original idea: starting-point beats for styles such as electronica, rock, jazz, hip-hop and four-on-the-floor house. Each template sets:
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
