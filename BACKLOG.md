# BeatVox Backlog

Ideas and requests not yet scheduled. See [PROPOSAL.md](PROPOSAL.md) for the plan and phases.

## Patterns and recipes

- [x] **Track level and humanize are separate.** Each voice has a steady `level` (0–1, 1 = natural) for the mix, and the v1.93 velocity walk is now a `humanize` multiplier on top (recipe-wide amount 0–1). Replaces the MIDI-style `velocity` 50–110/127, which drifted so far that a style's relative levels were lost within a few bars. A per-track level fader in Advanced mode can use it directly.
- [x] **Undo and redo** (Nov 2026). ↶ and ↷ beside keep evolving, plus ⌘Z and ⇧⌘Z: the last 50 steps of the beat (its rows, the knobs except volume, and the style it came from). NEW BEAT, EVOLVE, RE-SLICE, a style pick, a dragged slice or a quick pattern is one step each; box taps, or turns of one knob, within 2 seconds of each other are one step; each automatic evolve is a step. Undo turns keep evolving off so the beat stays put; a new change clears redo; a new voice clears the history. Possible next: a history strip of tiny grids to jump back to any step.
- [ ] **Save settings as a recipe.** A "save" button that stores the current beat as a recipe so a pattern you like isn't lost. The recipe holds: slices, patterns, voice/slice assignments, tempo, pitch, pan, effects and seed.
- [ ] **Re-load recipes.** A list of saved recipes to load back in, kept locally on the device. Also loadable from Roundware for shared ones.

- [x] **RE-SLICE** (Nov 2026). A button beside NEW BEAT and EVOLVE: every playing row gets a slice no row is playing, no two alike, picked at random whatever the row's role (on purpose: it's for getting lucky). Rows given a slice by hand keep theirs. Choosing a style puts role-matched slices back.
- [ ] **GO CRAZY button.** One big button that makes a new random beat, re-slices, and nudges the knobs at the bottom (tempo, pan, pitch, space, human) to random values within sensible ranges. For fun and happy accidents, like Random's NEW BEAT taken further.
- [ ] **A fuller effects section.** Today the effects are a fixed chain (per-row delay and reverb sends, EQ, compression, limiter) set by presets and the Space knob. Open more of it up: delay time and feedback, reverb size, filter sweeps, maybe distortion or bit-crush, and per-row sends. Saved in the recipe.
- [ ] **Review and expand panning.** Today the Pan knob sets how wide each row's auto-pan wanders. Review how it sounds, and look at per-row pan positions, pan patterns tied to the beat, and how panning reads in the shared MP3 and video.

## Sharing, reVox and storage

- [x] **Instruments and recipes are separate.** An instrument (`src/lib/instrument.ts`) is a voice and its exact slices with drum-role scores; a recipe is how it's played. A beat names its instrument; on another instrument it picks slices by role. A reVox is someone else's instrument played with your own beats.
- [x] **BeatVox's own map** (Nov 2026), the home page: only mixes, each at its maker's place, joined by lines from the first mix of the same vox (the constellation); dots zoomed out, clock markers zoomed in; details in a sheet or side panel; filters from the project's listen tags plus reVox permission; wander (random next mix, from anywhere or the same vox, map flies to it).
- [x] **Riso globe** (Nov 2026): every map is MapLibre with BeatVox's own riso style on OpenFreeMap's OpenStreetMap vector tiles; the home map is a globe.
- [ ] **A backup for the map tiles.** OpenFreeMap is free, donation-funded and has no SLA. If it goes away: MapTiler (same tile format, so the style works unchanged; paid above a free tier), self-hosting OpenFreeMap's weekly planet build, or Protomaps (one file on any host; the style would need porting to its layer names).
- [ ] **A backup for place search.** The place picker's search uses Photon's public server (free, fair use, no guarantee). If it's slow or gone: self-host Photon, or a keyed service (MapTiler, Stadia, LocationIQ). Tap and "where I am" keep working either way.
- [ ] **Map labels in Courier Prime:** needs our own label-font files (glyphs) hosted with the app; OpenFreeMap only serves Noto Sans.
- [ ] **Map, later:** wander limited to an area; the clock sprouting into the ring on the map itself; marker clustering once there are many mixes.
- [ ] **Tag existing reVox-able BeatVoxes with revox-allowed (1129).** The tag is live (Nov 2026) and new uploads carry it on the vox and its mixes when reVox is allowed; older allowed voxes and their mixes need it added by hand to show under the map's "Can be reVoxed" filter.
- [x] **Each reVox is connected to its source.** Store the "reVoxed from" link (the source contribution's id), so the chain or family tree can be shown and walked in both directions.
- [x] **The ring share page** (design round 5 on the canvas, Nov 2026). The beat's grid wrapped into a circle is the loop player: 8 rings of 16 steps, hits colored by sound, a sweep for the playhead, play/pause in the middle. Below it: THE SOURCE VOX (play only), a small map of this vox's beats that opens a map overlay, and REVOX THIS VOX. The same ring is the link-preview image, with a "copy as text" share (colored squares, like Wordle) as an extra.
- [x] **reVox from the share page.** REVOX THIS VOX opens `/?revox=<mix id>`: the studio loads that vox with its saved slices and starts from its beat (waiting for Play). Sending it adds only the new loop (tagged reVox mix, under the original vox) and its recipe, which names the BeatVox it came from (`revoxOf`). Its share page says "made with the vox from …".
- [x] **Link previews with an animated card** (Nov 2026): the studio makes a 16-frame GIF of the ring at send time and uploads it (tag `beatvox-card`, 1130); a Netlify Edge Function fills in the share page's preview tags. BeatVoxes sent before this preview as text only.
- [ ] **Cards for older BeatVoxes:** render and upload one for each (a one-off script, or the share page offering to make it), or a server-side renderer.
- [ ] **Deploy to beatvox.app.** The domain is registered, with DNS at WordPress. Point it at the Netlify site (add the domain in Netlify, then the DNS records at WordPress), turn on HTTPS, and check share links, link previews and the edge function on the new address.
- [ ] **Netlify from Git:** push the repo to GitHub and link it in Netlify, so a push deploys (the edge function deploys with the site).
- [ ] **Idea: the clock sprouts its rays.** The small loop button (16 squares round the play button, the beat marked on them) grows the full ring grid's "rays" when it goes into full playback, for example on the map when a card opens.
- [ ] **Loudness-normalize each voice (LUFS).** Today a recording is peak-normalized, so one loud plosive makes the whole voice quiet. Normalize to a loudness target with a peak ceiling, so every participant's instrument, reVoxes and MP3s in the Roundware stream sit at the same loudness. Fits Phase 2.
- [x] **Store the original and the BeatVoxes separately.** Built: raw voice → mix (and its recipe) and instrument as separate Roundware assets (PROPOSAL §6).

## Beat templates and drum roles

- [x] **Recipe format.** JSON with 16-character patterns in drum-machine notation (`x` hit, `X` accent, `o` ghost, `.` rest), per-voice role, optional slice, and tempo, swing, space and evolve settings. See `src/lib/recipe.ts`. Styles and saved beats share it.
- [~] **Style templates.** Started: a Style menu in Listen with BeatVox (v1.93-style grooves that keep evolving), House, Boom Bap, Rock, Breakbeat, Dembow, Trap and Drum & Bass (`src/styles/*.json`), about 10 beats each; NEW BEAT plays another in the style. Still to do: jazz (needs triplet or 8th-note swing) and evolve rules per style. Original idea: starting-point beats for styles such as electronica, rock, jazz, hip-hop and four-on-the-floor house. Each template sets:
  - per-voice patterns and a drum role per voice;
  - tempo range, swing and effects preset;
  - how Evolve is allowed to change it, so a template keeps its feel.
- [~] **Many beats per style, from real drummers** (Nov 2026). Most people want an established groove right away, so each style should hold a bunch of beats and NEW BEAT should pick another from the chosen style (v1.93 stays random). Source: the Groove MIDI Dataset (Google Magenta, CC BY 4.0: real drummers, ~490 takes in 4/4), kept beside the repo in `../sources/google-groove-midi/`. Done: `dev/grooves.ts` pulls one or two main grooves out of each take (lined up to the downbeat, passing taps dropped, swing measured), and the studio's dev-only GROOVE AUDITION panel plays them with the loaded voice; KEEP saves to `../sources/groove-picks.json`. Still to do:
  - pick by ear, then a script that turns the picks into style files;
  - styles that hold many beats, and NEW BEAT choosing among them;
  - 2-bar (32-step) patterns: many grooves (DnB's two-step above all) need two bars;
  - optional fills in the last bar of 4 or 8;
  - write our own for what the dataset lacks: house, trap, DnB, dembow, breakbeat;
  - **credit** "Groove MIDI Dataset by Google Magenta, CC BY 4.0" on the About page once any of its grooves ship (the license requires it).
- [x] **Guess which drum each slice suits.** Done in `src/lib/audio/drumRoles.ts`: styles deal slices by role, Evolve keeps role voices on good fits, drum roles get tighter gates, and the slicer lab shows each slice's role. Possible next: per-role tone shaping (low shelf on kicks). Original idea: Classify slices by sound and put them on matching voices in templates:
  - **kick:** low spectral centroid, energy below ~200 Hz, short (deep vowels, "b", "d", "oo");
  - **snare:** broadband and noisy mid-range with a sharp attack ("t", "k", "ch", "p");
  - **hi-hat:** high centroid, very noisy (high spectral flatness), very short (sibilants "s", "sh", "ts");
  - **tonal / other:** voiced, pitched slices for melodic or "lead" voices.

  Each slice gets scores for all roles, so a template can take the best kick, the two best hats, and so on. It could also shape slices to fit their role: shorter for hats, a low-shelf boost for kicks. Prototype in the slicer lab by showing the role per slice and letting you audition by role.

## Slicer UI

- [ ] **One waveform with a method dropdown.** Replace the lab's three stacked lanes with a single waveform and a "slice by" dropdown (Mixed default, Syllables, Attacks), to save screen space. Do this when the slicer moves into the app's Voice card.

## About and legal

- [ ] **Review all the copy.** Read every piece of text in the app (studio, map, share pages, About, welcome card, buttons, hints, errors, statuses) for voice, clarity and consistency before launch.
- [~] **An About page.** Built (Nov 2026, design round 9) as an overlay over any page, so a beat or Wander keeps going: a sheet on a phone, a side panel on a laptop, opened by the round ? beside the wordmark, at `/about` or `#about-<section>`, and from "Read the terms" on the send step. The copy is in `src/about/AboutContent.svelte`; still to do: rewrite it in Halsey's voice and fill the highlighted placeholders (bio, photo, where it was shown, contact email, Roundware terms link, hosting and analytics). A first visit to the map also gets a welcome card (`src/map/Welcome.svelte`), shown once. Original idea: Who made BeatVox (Halsey, and its 2008 history), the project's goals, and mainly a FAQ on using what you make:
  - **You own what you make.** Your voice, your BeatVoxes and the MP3s and GIFs are yours to use however you like.
  - **The project may use them too:** share them, highlight them, and host them (on the map, the share pages and in Roundware).
  - **Credit is appreciated, not required.**
  - **Only use material you have the right to use.** Record your own voice, or someone's with their permission; no recordings of other people's songs, speeches or the like that you don't have rights to.
  - **Legal disclaimers** (no warranty, the service may change or go away, removal requests, how the location and the recordings are kept), lined up with the project's Roundware terms.
