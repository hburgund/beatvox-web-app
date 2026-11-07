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
    {"pattern": "X...X...X...X...", "role": "kick", "velocity": 108},
    {"pattern": "....X.......X...", "role": "snare"}
  ]
}
```

**Patterns:** 16 characters, one per sixteenth note: `x` hit, `X` accent, `o` ghost note, `.` rest. v1.93-style `1`/`0` also works. Spaces and `|` are ignored, so `"x... x... x... x..."` is fine.

**Voice fields:**
- `pattern`: required.
- `role`: `kick`, `snare`, `hat`, `perc`, `tonal` or `any`. This picks which slice of the voice plays it.
- `velocity`: starting loudness, 50–110 (it drifts while playing, as in v1.93).
- `on`: `false` to start the voice muted.
- `delaySend`, `reverbSend`: 0–1.

Up to 8 voices.

**Style fields:**
- `bpm`: tempo.
- `swing`: 0–0.5, how late the off-beat sixteenths land.
- `pitch`: playback rate, 1 = normal.
- `panning`: 0–100.
- `space`: 0–100, the Space knob.
- `evolve`: `{"auto": true, "every": 3}` keeps changing the beat every 3 seconds.
