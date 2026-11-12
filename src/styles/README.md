# Styles

Each `.json` file here is one entry in the Style menu, in filename order. To add a style, copy a file, change `name` and the patterns, and give it a new number prefix. `npm test` checks every file.

The format is the BeatVox recipe format (see `src/lib/recipe.ts`), the same one a participant's saved beat uses. A style has `"kind": "style"` and no instrument, so it works with any voice: each voice's `role` picks the slice it plays.

```json
{
  "format": "beatvox-recipe",
  "version": 1,
  "name": "House",
  "kind": "style",
  "bpm": 124,
  "swing": 0.05,
  "space": 30,
  "evolve": {"auto": false},
  "voices": [
    {"pattern": "X...X...X...X...", "role": "kick", "level": 1},
    {"pattern": "....X.......X...", "role": "snare", "level": 0.85}
  ]
}
```

**Many beats in one style:** give the file a `beats` list instead of `voices`. Settings at the top (`bpm`, `swing`, `space`…) are the style's; each beat has a `name`, its `voices`, and any settings it changes. Picking the style plays one of its beats at random, and NEW BEAT plays another (each once before any repeats). See `02-house.json`.

```json
{
  "format": "beatvox-recipe", "version": 1, "name": "House", "kind": "style",
  "bpm": 124, "swing": 0.05, "space": 30,
  "beats": [
    {"name": "Classic", "voices": [{"pattern": "X...X...X...X...", "role": "kick"}]},
    {"name": "Deep", "bpm": 120, "swing": 0.1, "voices": [{"pattern": "X...X...X...X...", "role": "kick"}]}
  ]
}
```

**Patterns:** 16 characters, one per sixteenth note: `x` hit, `X` accent, `o` ghost note, `.` rest. v1.93-style `1`/`0` also works. Spaces and `|` are ignored, so `"x... x... x... x..."` is fine.

**Voice fields:**
- `pattern`: required.
- `role`: `kick`, `snare`, `hat`, `perc`, `tonal` or `any`. This picks which slice of the voice plays it.
- `level`: the track's mix level, 0–1. 1 (the default) is the recording's natural level; 0.5 is about 6 dB quieter. It stays put; the beat-wide `humanize` makes each hit wander below it.
- `pan`: where the voice sits, -1 (left) to 1 (right). One number keeps it there (FIXED); a pair like `[-0.6, 0.6]` lets it wander between them (ROAM). Leave it out for the default by role, spread like a drum kit in a mix: kick fixed in the middle, snare fixed 10% left, hats roaming 10–40% right, percussion roaming wide (-40% to 70%), tonal roaming the middle 40%, anything else the middle 60%. A second voice of the same role goes to the other side (a second hat roams 10–40% left), so they spread out.
- `on`: `false` to start the voice muted.
- `delaySend`, `reverbSend`: 0–1.

Up to 8 voices.

**Style fields:**
- `bpm`: tempo.
- `swing`: 0–0.5, how late the off-beat sixteenths land.
- `pitch`: playback rate, 1 = normal.
- `humanize`: 0–1, how much each hit's loudness wanders, like a person playing. 1 (the default) is v1.93's amount: hits drift between about 45% and 100% of the track's level. 0 makes every hit exactly the level.
- `space`: 0–100, the Space knob.
- `evolve`: `{"auto": true, "every": 3}` keeps changing the beat every 3 seconds.
