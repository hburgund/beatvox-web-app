# BeatVox (web)

Rebuild of BeatVox v1.93 (Max/MSP, 2009) as a web app. See [PROPOSAL.md](PROPOSAL.md) for the plan and [BACKLOG.md](BACKLOG.md) for later ideas.

## Run

```bash
npm install
npm run dev
```

- http://localhost:5173/ is **the app**: Record, Listen, Share.
- http://localhost:5173/slicer.html is the **slicer lab**: compares the Attacks, Syllables and Mixed slicers, plays slices and a simple beat, and tunes the slicer parameters.

In dev, both pages can load the private 2008 reference recordings from `docs/beatvox-reference/` (the "dev: reference recordings" menu in the Voice card). They are served by a dev-only plugin (`dev/referenceAudio.ts`) and are never part of a build.

## Code map

- `src/lib/audio/engine.ts`: the v1.93 beat engine (8 voices × 16 steps, gate envelope, per-track level with a humanize walk, auto-pan, downbeat changes, kickoff, Evolve, loop capture). Seeded, so a beat can be replayed exactly.
- `src/lib/audio/voiceBank.ts`: the audio side of the engine. The engine sends every hit, pan move and effects change here as a command, so a stretch can be taped and played back exactly.
- `src/lib/audio/render.ts`, `mp3.ts`: the shared piece. Renders a taped capture offline (your voice, ½ bar, the loops, the effects tail) and encodes it to MP3 in a worker (LAME via `wasm-media-encoders`).
- `src/lib/roundware.ts`: sending to Roundware v3 (participant token, session, the four uploads). `src/app/PlacePicker.svelte` is the Leaflet map for choosing where it goes.
- `src/lib/audio/fx.ts`: effects (delay, reverb, EQ, compression, limiter) and the Simple-mode "Space" knob.
- `src/lib/audio/slicer.ts`, `analysis.ts`, `pitch.ts`: slicing and pitch.
- `src/lib/audio/recorder.ts`, `prepare.ts`: mic recording and clean-up.
- `src/lib/ui/`: the widgets in the "light riso" look (☒ beat grid, dials, ☒ checkbox, waveform, beat lights).
- `src/app/`: the app: one studio screen (`VoiceCard`, `BeatCard`), the save bar along the bottom (`SaveBar`), the share sheet (`ShareSheet`) and the sending popup (`SendDialog`). `theme.css` holds the colours and Courier Prime; `session.svelte.ts` holds the state.

## Tests

```bash
npm test
```

## Phone testing

Phones only allow the mic over HTTPS, so test builds go to Netlify:

```bash
npm run deploy
```

- App: https://beatvox-lab.netlify.app/
- Slicer lab: https://beatvox-lab.netlify.app/slicer.html

The deployed build has no reference recordings. Those are served only by the local dev server.
