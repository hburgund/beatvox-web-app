# The recipe JSON

A recipe is a beat saved as JSON. The built-in styles are recipes (in `src/styles/`). Every beat sent to the map is stored as one too: a Roundware asset of media type `data`, tag `beatvox-recipe`, whose parent is the mix (the MP3 loop) it was made with.

This page is for anything else that needs to read one. The code that defines the format is `src/lib/recipe.ts` (fields and the validity check) and `src/lib/played.ts` (the `played` field).

## The fields

| Field | What it is |
|---|---|
| `format` | Always `"beatvox-recipe"`. |
| `version` | `1`. |
| `name` | The title. |
| `kind` | `"style"` (a preset, for any voice) or `"beat"` (one person's beat, made with their voice). |
| `instrument` | Beats only: `{ id, assetId }`, the voice and slices the beat was made with. `assetId` is the Roundware asset of the raw voice. |
| `bpm` | Tempo, 20–300. |
| `swing` | 0–0.5: how late the off-beat sixteenths land. |
| `humanize` | 0–1: how much each hit's loudness wanders (0 = machine-steady). |
| `pitch`, `space` | The Pitch and Space knobs. |
| `evolve` | `{ auto, every }`: whether the beat changed by itself as it played, and every how many seconds. |
| `voices` | Up to 8 rows (tracks), each with its pattern: **how the beat started** (see below). |
| `played` | Beats sent to the map from Nov 2026: **what every row actually played in every bar** (see below). |
| `seed` | The random seed the beat was made with. |
| `mixAssetId` | The Roundware asset of the mix this recipe belongs to. |
| `revoxOf` | A reVox: the mix whose voice it plays. |
| `cardUrl` | The share card (animated GIF) for link previews. |
| `createdAt`, `participant` | When it was made, and by whom. |

A reader should ignore fields it doesn't know. BeatVox does, so new optional fields can be added without breaking anything.

## `voices`: how the beat started

One entry per row, top row first. Each has a `pattern` of 16 characters, one per sixteenth note, written like drum-machine notation:

```
"x...x...x...x..."     x = hit   X = accent   o = ghost note   . = rest
```

`1` and `0` are accepted too (`"1000100010001000"`).

Each entry can also say:

- `on`: `false` if the row was switched off. Missing means on.
- `role`, `sliceRole`: what it's for: kick, snare, hat, perc, tonal or any.
- `slice`: which slice of the voice it plays.
- `level`: 0–1.
- `pan`: one number for a fixed place, or `[low, high]` for one that wanders.
- `delaySend`, `reverbSend`.

This is the beat as it was when the 8 bars started saving. A beat that evolved, or that someone changed while it saved, sounds different later on. For that, use `played`.

## `played`: the beat as heard, bar by bar

**One string per bar** (a beat sent to the map has 8). **Each string holds all 8 rows for that bar.**

A string is 32 hex digits:

- Split it into 8 chunks of 4. Each chunk is one row, top row first, in the same order as `voices`.
- Each chunk is that row's 16 steps. Each hex digit covers 4 steps, and its highest bit is the first of those steps.
- Read as a 16-bit number, the chunk's highest bit is step 1 and its lowest bit is step 16.

| Hex | Steps | Hex | Steps |
|---|---|---|---|
| `0` | `....` | `8` | `x...` |
| `1` | `...x` | `9` | `x..x` |
| `2` | `..x.` | `a` | `x.x.` |
| `3` | `..xx` | `b` | `x.xx` |
| `4` | `.x..` | `c` | `xx..` |
| `5` | `.x.x` | `d` | `xx.x` |
| `6` | `.xx.` | `e` | `xxx.` |
| `7` | `.xxx` | `f` | `xxxx` |

So `8888` is four on the floor, `ffff` is every sixteenth, and `0000` is a row that didn't play that bar.

### A worked example

A real one, from a beat that evolved after 5 bars:

```json
"played": [
  "82240082babe80200000000000000000",
  "82240082babe80200000000000000000",
  "82240082babe80200000000000000000",
  "82240082babe80200000000000000000",
  "82240082babe80200000000000000000",
  "82268082babe80200000000000000000",
  "82268082babe80200000000000000000",
  "82268082babe80200000000000000000"
]
```

Bar 1, split into rows:

| Row | Chunk | Steps |
|---|---|---|
| 1 | `8224` | `x... ..x. ..x. .x..` |
| 2 | `0082` | `.... .... x... ..x.` |
| 3 | `babe` | `x.xx x.x. x.xx xxx.` |
| 4 | `8020` | `x... .... ..x. ....` |
| 5–8 | `0000` | (didn't play) |

- **Rows 3 and 4:** their chunks are the same in all 8 strings, so those rows played the same thing throughout.
- **Rows 1 and 2:** they changed at bar 6. Row 1 went `8224` → `8226`, gaining a hit on step 15. Row 2 went `0082` → `8082`, gaining a hit on step 1.
- **The `babe`:** a pattern can happen to spell a word, because the hex digits include a–f.

### Decoding it

JavaScript:

```js
/** One bar's string as rows[row][step], true for a hit. */
function decodeBar(bar) {
  return Array.from({ length: 8 }, (_, row) => {
    const bits = parseInt(bar.slice(row * 4, row * 4 + 4), 16);
    return Array.from({ length: 16 }, (_, step) => (bits & (1 << (15 - step))) !== 0);
  });
}
```

Python:

```python
def decode_bar(bar):
    """One bar's string as rows[row][step], True for a hit."""
    return [[bool(int(bar[r*4:r*4+4], 16) & (1 << (15 - s))) for s in range(16)] for r in range(8)]
```

### What it records, exactly

- **What was heard, not what was written.** It comes from the hits the beat engine actually played while the bars were saved. A row switched off mid-bar, or a change made while it saved, shows up.
  - Accents and ghost notes aren't kept: a hit is a hit. For those, see `voices`.
- **Bar 1 of `played` is the first bar of the mix's MP3 loop.** The loop repeats all its bars, so the bar playing at time `t` seconds into the loop is `floor(t / barLength) % played.length`, where `barLength = 240 / bpm`. Within that bar, the step is `floor((t % barLength) / barLength * 16)`.
- **Swing and humanize land hits a little late, never early.** A hit is counted on the step it was meant for.
- **It's missing on beats sent before Nov 2026, and on styles.** Readers should then fall back to `voices` for every bar.
- **Size:** 32 characters a bar, about 260 for 8 bars.

## Where BeatVox uses each

- **Map, Wander, share pages:**
  - The ring shows the bar playing from `played` while the beat plays.
  - When it's stopped, or there's no `played`, it shows `voices`.
- **The share card GIF:** one bar, from `voices`.
- **reVox and the studio:** load a beat from `voices` and the settings, so it starts as the original did.
- **The share videos:** made in the browser from the same record of hits, before anything is sent.
