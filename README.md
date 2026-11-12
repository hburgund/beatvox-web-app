# BeatVox (web)

Rebuild of BeatVox v1.93 (Max/MSP, 2009) as a web app. See [PROPOSAL.md](PROPOSAL.md) for the plan and [BACKLOG.md](BACKLOG.md) for later ideas.

## Run

```bash
npm install
npm run dev
```

- http://localhost:5173/ is **the app**: Record, Listen, Share.
- http://localhost:5173/slicer.html is the **slicer lab**: compares the Attacks, Syllables and Mixed slicers, plays slices and a simple beat, and tunes the slicer parameters.
- http://localhost:5173/maps.html compares **map styles** side by side (picture tiles against vector styles), with the real mixes on each. Dev only, not in the build.

In dev, both pages can load the private 2008 reference recordings from `docs/beatvox-reference/` (the "dev: reference recordings" menu in the Voice card). They are served by a dev-only plugin (`dev/referenceAudio.ts`) and are never part of a build.

## Code map

- `src/lib/audio/engine.ts`: the v1.93 beat engine (8 voices × 16 steps, gate envelope, per-track level with a humanize walk, auto-pan, downbeat changes, kickoff, Evolve, loop capture). Seeded, so a beat can be replayed exactly.
- `src/lib/audio/voiceBank.ts`: the audio side of the engine. The engine sends every hit, pan move and effects change here as a command, so a stretch can be taped and played back exactly.
- `src/lib/audio/render.ts`, `mp3.ts`: the shared piece. Renders a taped capture offline (your voice, ½ bar, the loops, the effects tail) and encodes it to MP3 in a worker (LAME via `wasm-media-encoders`).
- `src/lib/roundware.ts`: sending to Roundware v3 (participant token, session, the four uploads). `src/app/PlacePicker.svelte` is the map for choosing where it goes: search as you type (`src/lib/geocode.ts`, Photon's free OpenStreetMap search at photon.komoot.io), "where I am", or a tap on the map.
- `src/lib/audio/fx.ts`: effects (delay, reverb, EQ, compression, limiter) and the Simple-mode "Space" knob.
- `src/lib/audio/slicer.ts`, `analysis.ts`, `pitch.ts`: slicing and pitch.
- `src/lib/audio/recorder.ts`, `prepare.ts`: mic recording and clean-up.
- `src/lib/ui/`: the widgets in the "light riso" look (beat grid with hits colored by sound, the beat ring and its small clock button, dials, ☒ checkbox, waveform, beat lights).
- `src/lib/card.ts`: the share card, an animated GIF (16 frames, one step each) of the beat's ring with its title, made in the browser when a BeatVox is sent and uploaded with it (tag `beatvox-card`); its recipe records the address. `src/lib/preview.ts` and `netlify/edge-functions/share-preview.ts` put the title, a line and the card into a share page's `<head>` for link previews.
- `src/map/risoStyle.ts`, `risoMap.ts`: every map (home, share page, place picker) is MapLibre GL drawing OpenStreetMap vector tiles from OpenFreeMap in BeatVox's own riso style (the home map as a globe). The tiles' terms require the credit "OpenFreeMap © OpenMapTiles Data from OpenStreetMap", which the style carries.
- `src/map/`: the home page (`/`): every BeatVox and reVox on a map where its maker put it, joined to the others made from the same vox; tap one for its ring player and details (a sheet on a phone, a side panel on a bigger screen); filters from the project's listen tags; wander plays mixes one after another. `src/lib/mapData.ts` loads it. The studio is at `/studio`.
- `src/share/`: a BeatVox's share page at `/b/<id>`: the beat as a ring that is also its gapless loop player, the source vox, and a map of every beat made from the same vox. `src/lib/shared.ts` loads it all from Roundware's public endpoints (no sign-in). In production the host must serve `index.html` for `/studio` and `/b/*`.
- `src/app/`: the app: one studio screen (`VoiceCard`, `BeatCard`), the save bar along the bottom (`SaveBar`), the share sheet (`ShareSheet`) and the sending popup (`SendDialog`). `theme.css` holds the colours and Courier Prime; `session.svelte.ts` holds the state.

## Tests

```bash
npm test
```

## Phone testing

Phones only allow the mic over HTTPS, so test builds go to Netlify. `netlify.toml` has the build settings and the share pages' link-preview edge function; `public/_redirects` sends `/studio` and `/b/*` to the app. Once the repo is on GitHub and linked in Netlify, a push deploys; until then:

```bash
npm run deploy
```

- App: https://beatvox.app/ (Netlify site beatvox-lab; deploys on every push to main)
- Slicer lab: https://beatvox.app/slicer.html

The deployed build has no reference recordings. Those are served only by the local dev server.

## Groove audition (dev only)

The studio's dev server shows a GROOVE AUDITION panel under the beat: candidate style beats pulled from the [Groove MIDI Dataset](https://magenta.tensorflow.org/datasets/groove) (Google Magenta, CC BY 4.0). It needs the dataset in `../sources/google-groove-midi/` (beside this repo, not in it). Load a voice, pick a genre, then `[` and `]` step through the grooves and `K` keeps one. Picks are saved to `../sources/groove-picks.json`. See `dev/grooves.ts`.

## Credits

- Style beats taken from the [Groove MIDI Dataset](https://magenta.tensorflow.org/datasets/groove) by Google Magenta, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
