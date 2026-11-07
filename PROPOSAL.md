# BeatVox for the Web — Proposal

*Draft 2 · November 2026 · rebuilding BeatVox v1.93 (Max/MSP, 2009) as a web app for phones and laptops, with Roundware v3 for sharing*

**Changes since draft 1:**
- Added an effects module.
- Moved to Roundware v3; no envelopes.
- Sharing is now save or share from the person's own device. Kiosk and performance modes are deferred.
- Added a slicing comparison.
- Added Simple and Advanced modes.
- Added reVox, an opt-in option to let others remix a contribution.
- Removed the helper service.
- Spelled out where WAV/PCM is used and where MP3 is.

---

## 1. What v1.93 does (worked out from the patch)

From `docs/beatvox_v1.93.maxpat` and the abstractions in `docs/beatvox-reference/`. The goal is to **match the behavior**, not copy the Max structure. Wherever the web has a cleaner way to do something, this proposal uses it.

**Record**
- Mono mic → compressor/gate (`omx.comp~`) → 15 s buffer. Waveform display, countdown, NEW / RECORD / PLAY / NEXT.

**Slicing**
- `segment~` (Tristan Jehan's segmenter, pitch mode, FFT 1024 / hop 512, tunable `thresh`, `wait`, `amp-range`).
- Each onset becomes a cue, capped at 1500 ms.

**Beat engine**
- **8 voices × 16 steps**, where steps are 16th notes.
- Each voice:
  - **Pattern** (`hb.rhyvoice2.vst`): presets (all on, quarters, eighths, a fixed "groove" `1001011000010111`, all off) or random patterns.
  - **Velocity:** a **brownian walk between 50 and 110**, so dynamics drift like a person playing.
  - **Slice** ("pitch"): drawn urn-style, so no two voices share one.
  - **Player** (`hb.trigger` → `hb.voxnode`): two alternating players. Each hit is gated with ~100 ms in, ~300 ms hold, ~100 ms out, and a new hit crossfades out the previous one. Global pitch-bend changes playback speed.
  - **Auto-pan:** a random ramp every 2–10 s. Shape is linear, sine or random. Panning is constant-power and quad-capable (`hb.quadautopan2`, `pan4S`).
- **Changes wait for the next downbeat** (`dbt`).
- **Kickoff:** 1 voice at the start, +1 at 5 s, +1 at 10 s, then Evolve switches on at 12 s and fires every 3 s.
- **Controls:**
  - New Beat (re-randomize everything);
  - Evolve Beat (one random change), plus Evolve Frequency;
  - VOLUME, TEMPO, PANNING, PITCH.
- **Master processing:** Waves EQ (`beatvox_eq1/2`) and Renaissance Vox compression (`beatvox_rvox1`).

**Capture**
- Records up to 30 s of output → MP3 → email, typed on an on-screen keyboard.

**`and_justice.mp3`:** the pattern repeats about every **2.7 s** (16 steps at ~89 BPM). This is the reference for tuning the port.

**Your 2009 TODO notes** (comments in the patch) became most of the improvements list:
- waveform with slices;
- draw patterns;
- add a previous person's voice;
- play the full recording now and then;
- a "craziness" control;
- grid cells that pulse when they fire;
- cue pre-roll;
- a kaoss-style XY pad;
- mic only on while recording;
- reduce bass.

**Test material:** `beatvox-reference/samples/` (365 visitor recordings from 2008), `payc/` and `voxex4.wav` make an ideal test set for the slicer. They stay local and are never uploaded or committed. The same goes for `beatvox_emails.*`, which contains visitor email addresses.

---

## 2. Goals

1. **Sounds like BeatVox.** A faithful port of the v1.93 engine first, then improvements.
2. **Looks like BeatVox.** Retro Max widgets, refined.
3. **Works equally well on phones and laptops.** Each gets its own layout, not one squeezed into the other.
4. **Simple by default, deep when wanted.** A Simple mode anyone gets in seconds, and an Advanced mode with everything.
5. **Roundware v3 for sharing**, using its built-in save and share functions, with location on every contribution.
6. **reVox:** contributors can choose to let others play their voice (their *instrument*) with their own beats.

Later, not now: gallery kiosk mode and live performance mode (quad output, MIDI). The architecture leaves room for both.

---

## 3. Architecture

```
┌───────────────────────────── Browser app (static hosting, installable) ─────────────────────────────┐
│  UI ("maxkit" retro widgets)      Record │ Listen │ Share      Simple ⇄ Advanced                    │
│        │  state: slices, patterns, params, seeded randomness                                        │
│        ▼                                                                                            │
│  Audio engine (Web Audio, all PCM)                                                                  │
│   mic ─► raw PCM recorder ─► HPF + comp ─► voice buffer                                             │
│   Slicer (background worker) ─► slice list                                                          │
│   Sequencer ─► 8 voices ─► FX module (comp · delay · reverb · EQ · limiter) ─► speakers             │
│   Event log (every hit and change)                                                                  │
│        ▼                                                                                            │
│  Render (offline, same engine + FX) ─► [original | remix] ─► MP3 encoder                            │
│        ▼                                                                                            │
│  Roundware v3 client ─► upload, save/share, browse, reVox                                           │
└────────┼────────────────────────────────────────────────────────────────────────────────────────────┘
         ▼
   Roundware v3 server (existing)
```

**No helper service is needed now.** In draft 1, the helper would have:
- sent emails;
- served link-preview metadata (the title and image shown when a link is pasted into Messages or social apps).

Email is gone, and Roundware v3 handles sharing. If v3 doesn't produce good link previews, a tiny static function can be added later.

---

## 4. Audio engine

### 4.1 PCM inside, MP3 only at the edges

**All recording, slicing, playback, effects and rendering work on uncompressed PCM**, which is what WAV holds. MP3 is used in only two places: encoding the final shared file, and decoding other people's contributions when browsing them. Why:

- **Timing:** MP3 adds a small, encoder-dependent stretch of silence at the start and pads the end. That would shift every slice point and break tight loops.
- **Quality:** every MP3 encode loses detail. Slicing an MP3 and then re-encoding the remix means two lossy passes. reVoxing someone else's remix would mean three.
- **Speed:** Web Audio plays PCM directly, so there is nothing to decode per hit.
- **Size is no problem:** 15 s of mono 16-bit 44.1 kHz audio is about 1.3 MB in memory.

For reVox, the original voice is uploaded **lossless** (WAV, or FLAC at roughly half the size), if Roundware v3 accepts it. If it only takes MP3, use a high bitrate (256 kbps or more) and store the encoder delay in the recipe so slice points stay exact.

### 4.2 Recording
- Raw PCM from the mic through an AudioWorklet (more reliable on iOS than the built-in recorder).
- The phone's voice processing (echo cancellation, noise suppression, auto-gain) is off by default because it blurs attacks. A "noisy room" toggle turns it back on.
- High-pass to cut rumble, gentle compression, normalize afterwards. Mic shuts off as soon as recording stops.

### 4.3 Sequencer and voices
- A standard look-ahead scheduler timed by the audio clock: sample-accurate and steady on phones.
- **8 voices × 16 sixteenth-note steps.** Slices drawn urn-style. Each voice has a steady mix **level** (0–1, 1 = the recording's natural level) for balancing tracks. On top of it, a **humanize** walk makes each hit wander between 45% and 100% of that level. At full strength that is v1.93's 50–110 velocity walk, now without MIDI units, and a beat-wide `humanize` amount can calm it down to steady.
- **Lighter than the Max voices:** each hit is a one-shot player reading from the shared voice buffer, with a short envelope (100/300/100 ms by default) and a quick fade on the previous hit. The result matches the two-player crossfade.
- New Beat, Evolve and edits are applied on the next downbeat. The kickoff ramp and evolve timer are reproduced.
- Auto-pan per voice: random ramp, linear, sine or random shape, constant-power, stereo.
- **Deterministic:** randomness comes from a seed, and every hit is logged. That makes offline rendering and recipes exact.

### 4.4 Effects module (new)

| Stage | What | Built from | Simple mode | Advanced mode |
|---|---|---|---|---|
| Per-voice sends | each voice sends some of its signal to delay and reverb | gain nodes | random per voice | per-voice send levels |
| **Delay** | tempo-synced echo (1/8, dotted 1/8, 1/4), filtered feedback, optional ping-pong | DelayNode + filters | on/off | time, feedback, tone, mix |
| **Reverb** | rooms from small to huge | ConvolverNode with generated impulse responses (no files to load); real IRs optional | one "Space" knob | size, decay, pre-delay, damping, mix |
| EQ | low cut (your "reduce bass") + presence | biquad filters | fixed | low cut, presence |
| **Compression** | glue the mix (replaces RVox) | DynamicsCompressorNode | fixed preset | threshold, ratio, attack, release, makeup |
| Limiter | stops clipping, including on phone speakers | compressor at a hard setting | always on | ceiling |

- The same chain runs in the offline render, so the shared MP3 sounds exactly like what the person heard.
- **FX presets:** Dry, Room, Hall, Dub (delay-heavy), Space. They are saved in the recipe.
- **Later:** per-voice filter or bitcrush, and filter sweeps on the XY pad.

### 4.5 Engine improvements (after the port, each switchable)
- **Editing:** draw patterns, tap a voice to audition it or swap its slice, mute/solo.
- **Slice view:** waveform with draggable slice markers.
- **"Craziness":** a single macro.
- **Feel:** swing, accents, full-recording moments.
- **XY pad:** pitch-bend and filter.

---

## 5. Slicing: options to discuss

The slicer is the heart of BeatVox. It decides whether the beat sounds percussive, syllabic or wordy. These are the options that work in a browser:

| Approach | What makes a slice | Available in the browser? | Pros | Cons |
|---|---|---|---|---|
| **A. Simple onset detector** (energy / spectral flux) | sudden rise in energy or spectral change, i.e. consonant attacks | write it ourselves (~200 lines), or adapt Meyda features | tiny, fast, easy to tune, no license issues, punchy percussive slices | splits mid-word on some sounds; misses soft onsets (m, n, l, vowels) |
| **B. Syllable segmenter** (smoothed speech-band envelope; slice at the dips between syllables) | each syllable | write it ourselves | suits voice best: every slice is one natural spoken unit; steady, musical lengths | slices start softer; slurred or fast speech can merge syllables |
| **C. Jehan-style pitch + onset** (what v1.93 used) | an onset *or* a change in pitch | Essentia.js (WASM) has onset functions and pitch trackers | closest to the original sound; slices can be tagged with pitch | Essentia.js is **AGPL** licensed (BeatVox would have to be open source too) and adds ~2–3 MB |
| **D. aubio** | several classic onset methods | no maintained browser build (aubiojs covers only part of it) | well-tested algorithms | packaging risk |
| **E. Word slicing via speech recognition** (e.g., Whisper running in the browser) | each word, with timestamps | yes (transformers.js), but a ~40–150 MB model download | word-level slices; could even show the words | heavy for phones, slow to start, misses non-speech sounds; a later, optional feature |

**Recommendation:**
- Build **A and B ourselves** as one slicer with a **"slice by" setting**:
  - **Mixed**: syllable boundaries, sharpened by onsets. **The default (decided after listening in the lab).**
  - **Syllables** (B);
  - **Attacks** (A).
- All three stay available as a choice. In the app this becomes a dropdown with one waveform, not three stacked lanes.
- Add **pitch tagging** using a small pitch tracker (YIN, easy to write). That recovers what Jehan's segmenter added: slices can be ordered by pitch, so the slice number means something musical again, and Advanced mode can say "pick high slices for voice 3".
- Every mode shares the same clean-up: ~10–30 ms pre-roll, short fades, drop slices that are too short or quiet, cap length at 1500 ms.
- **Settle it by ear:** the first step of the build (§9, phase 0) is a slicer test page. It loads the 2008 recordings, shows the slices from each method on the waveform, and plays them back. We pick defaults together from that. Essentia.js stays a fallback if the licensing is acceptable.

---

## 6. Share: capture → MP3 → Roundware v3

**Capture by loops.**
- The person picks a length, starts capture, and it begins at the next downbeat. They can keep playing while it captures.
- At ~2.7 s per loop, **4 / 8 / 16 loops ≈ 11 / 22 / 43 s**. Simple mode uses a fixed 8.

**Offline render.**
- The logged loops are rendered with the same engine and effects, so there are no glitches from a busy phone.
- **The mix is a seamless loop** (decided Nov 2026, replacing "voice, then remix" in one file). It's whole bars, and the effects tail after the last bar is folded back onto the start, so it can loop forever on Roundware. The raw voice is a separate asset. It's encoded to MP3 in a background worker.
- One offline render makes both files: the **loop** (for Roundware) and **voice → ½ bar → beat → tail** (to save on the device and send to friends; the Share tab offers both).
- **Gapless MP3:** the encoder writes no gapless header, so `mp3Core.ts` adds the standard LAME "Info" frame with the encoder delay and padding. Chrome then decodes the loop to exactly its sample length with no gap; FFmpeg on the server reads the same header.
- **How it's built:** the engine sends every hit, pan move, send and effects change to the audio graph as a small command (`voiceBank.ts`). Capture tapes those commands, plus the state at the first downbeat, so the render replays exactly what was heard, including any New Beat, Evolve or knob moves made during the capture. The voice is trimmed to its slices, and silence after the effects die away is cut.
- **Format:** 192 kbps stereo MP3, peak at -1 dBFS. The 8-bar loop is about 0.5 MB and the voice-plus-beat file 0.7–0.9 MB. Rendering and encoding both take about 2.5 s on a laptop.

**Submit.**
- A short form:
  - optional title or name;
  - location, from geolocation, or a pin on a map if they say no;
  - consent to public sharing;
  - **"Let others reVox this"** (off by default).
- **Then save or share.**
  - **Save:** the finished MP3 is already on the device, so it saves directly. On phones it goes through the system share sheet with the file attached (Web Share API); on laptops it downloads.
  - **Share:** a link built from the project's `sharing_url` (`…[id]`), which opens Roundware's share page (`/share/<id>`, backed by `GET /api/3/assets/{id}/shared/`).

**Roundware v3 mapping** (from `roundware.org/api/v3/openapi.json`):

| Step | Call | Key fields |
|---|---|---|
| Identify the device | `POST /api/3/participants/` | `project_id`, `device_id` (random, kept on the device), `client_type: "web"` → `participant_token` (sent afterwards as `X-Participant-Token`) |
| Start a visit | `POST /api/3/sessions/` | `project_id`, `participant_id`, `client_type`, `client_system` |
| **1. Raw voice** (the parent) | `POST /api/3/assets/` (multipart) | `media_type: audio`, `file` = the recording as made (before low cut and normalize), `latitude`, `longitude`, `tag_ids` (`beatvox-voice`, plus `revox-ok` when allowed), `agreed_terms`, `recorded_at`, optional `contributor_name` |
| **2. BeatVox mix** (child of the voice) | `POST /api/3/assets/` | `media_type: audio`, `parent_asset_id` = the raw voice, `file` = the seamless-loop MP3, `description` (title), tag `beatvox-mix`, location |
| **3. Instrument** (child of the voice) | `POST /api/3/assets/` | `media_type: text`, `parent_asset_id` = the raw voice, `file` = the instrument JSON with `source.assetId` set to the voice: slice times, drum-role scores, clean-up settings (`src/lib/instrument.ts`) |
| **4. Recipe** (child of the mix) | `POST /api/3/assets/` | `media_type: text`, `parent_asset_id` = the mix, `file` = the recipe JSON naming its instrument by id and asset id (`src/lib/recipe.ts`). Sent as `.txt` if `.json` is refused |
| **reVox** | steps 2 and 4 only | the new mix's parent is the *original* raw voice, so every reVox hangs off the same voice; no new voice or instrument. The recipe names the original instrument, and the mix carries the reVoxer's own participant, location and title |
| Browse voices to reVox | `GET /api/3/assets/?project_id=…&tag_ids=revox-ok&paginate=true` | no geo filter in v3, so "nearby" is sorted on the device from `latitude`/`longitude` |
| Share page data | `GET /api/3/assets/{id}/shared/?project_id=…` | returns only `status: "pending"` until the contribution is approved, if the project holds contributions for review |

Notes on the mapping:
- **`parent_asset_id` is documented for photos and text attached to a recording**, not for audio children or grandchildren (voice → mix → recipe). To confirm on the server: audio children are accepted, play normally, and show on the map.
- **Looping:** the mix only loops seamlessly if Roundware's player loops it with Web Audio and handles MP3 encoder padding. A plain `<audio loop>` leaves a small gap.
- **The server converts uploaded audio with FFmpeg,** so a WAV or FLAC voice won't stay lossless, and the conversion can shift timing by a few milliseconds. The instrument stores exact slice times plus the slicer settings, so if the converted file has shifted, reVox can re-cut the downloaded voice with those settings, or line the stored times up with it. A per-project option to keep originals as uploaded would allow exact reuse (Q1).
- **Moderation:** with `auto_submit` off, share links show "pending" until approved. The share screen should say so.

**Instruments and recipes**
- An **instrument** is a voice recording and how it was cut: slice times and drum-role scores. A **recipe** is how it's played: patterns, tempo, effects. Built-in genre styles are recipes with roles but no instrument; a participant's saved **beat** is a recipe that names the instrument it was made on.
- Any instrument can play any recipe. On its own instrument a beat sounds exactly as saved. On another, its voices pick slices by the sound they had (kick-like, hat-like…), so the groove carries over to the new voice.

**reVox**
- **A reVox is someone else's instrument played with your own beats.**
- **Browse:** "voices you can reVox" are instruments whose owner allowed it, nearby or recent.
- **Use:** pick their voice, then play one of your saved beats, a style or a fresh beat with it.
- **Credit:** a reVox records what it came from, and its share page says "reVoxed from …". That builds a family tree of beats, and contributors could get a "your voice was reVoxed" count.
- **Opt-out later:** if someone turns reVox off, new reVoxes of their voice stop. Existing ones stay, since they were made with permission.

---

## 7. Simple and Advanced modes

| | **Simple** (default) | **Advanced** |
|---|---|---|
| Record | RECORD / PLAY / NEXT, countdown, waveform | + slices on the waveform, "slice by" setting, sensitivity, mic gain, noisy-room toggle |
| Listen | GO / STOP, **New Beat**, **Evolve**, VOLUME, one **Space** (FX) knob; grid visible and pulsing | + editable grid, per-voice slice / mute / solo, TEMPO, PITCH, PANNING, evolve frequency, probabilities, craziness, swing, full FX panel, XY pad |
| Share | loop length fixed at 8, title, location, reVox checkbox | + 4 / 8 / 16 loops, FX preset per share |

- The switch is in the header. Turning on Advanced works like opening a Max subpatcher: more panels slide in, and the look stays the same.
- Advanced settings are remembered per person (on their device).

---

## 8. Look and feel

A set of retro widgets, the "maxkit", reproducing the Max 5 look of the screenshots:
- the ☒ toggle;
- sliders with number boxes;
- ring buttons (green GO / NEXT, red STOP, blue NEW / New Beat / Evolve);
- pill buttons;
- the LCD countdown;
- rounded tabs;
- the soft blue and yellow panels;
- the 4×4 beat indicator in the header;
- the monospaced "BEAT VOX" wordmark.

The widgets are vector-drawn, so they stay crisp at any size. Refinements are limited to tidier spacing, cells that flash when they fire, a playhead, press states, and the slice waveform.

**Laptop (landscape).** Close to the original layout:
- sliders on either side of the Modify panel, grid below;
- mouse-drag drawing on the grid;
- keyboard shortcuts (space = start/stop, N = New Beat, E = Evolve, 1–8 = select voice);
- in Advanced, extra panels open beside the main one rather than in pop-ups.

**Phone (portrait).**
- Tabs across the top.
- Listen screen, top to bottom:
  - ring buttons in a row;
  - a big Modify panel;
  - the 8×16 grid (fits at ~20 px per cell). Tapping a row zooms it to full-size touch targets;
  - sliders horizontal, in a drawer.
- Advanced panels stack as collapsible sections.

**Tablet.** Uses the laptop layout in landscape and the phone layout in portrait.

---

## 9. Tech stack

| Area | Choice |
|---|---|
| Language / build | TypeScript + Vite |
| UI framework | **Svelte**, or React (see below) |
| Audio | Web Audio + AudioWorklet; slicing, rendering and MP3 encoding run in background workers |
| MP3 | `wasm-media-encoders` (LAME, MIT licensed) |
| Roundware | v3 client (official SDK if there is one, otherwise a thin typed client) |
| Tests | Vitest (engine, slicer, render matches live), Playwright (flows at phone and laptop sizes) |
| Hosting | any static host |

**What is Svelte?**
- It's a tool for building interactive web interfaces, like React or Vue.
- You write components (a slider, a toggle, the grid) as small files that mix HTML, CSS and logic.
- Svelte turns them into compact plain JavaScript when the app is built, instead of shipping a framework that runs in the browser.
- That suits BeatVox: hundreds of small widgets that update every step (the grid flashing at 16th notes), small download size on phones, and simple code.
- **The alternative is React:** a much bigger ecosystem and more developers know it. If you or future collaborators already work in React, or the Roundware v3 web tools are React-based, that tips it to React.
- Either way, the audio engine is plain TypeScript, independent of the UI framework.

---

## 10. Phases

| Phase | Deliverable |
|---|---|
| **0. Spike** ✅ (iPhone 16e tested; Android not yet) | Record on iPhone, Android and a laptop. **Slicer test page** comparing Syllables / Attacks / Mixed on the 2008 recordings. Play an 8×16 beat with basic reverb. |
| **1. Faithful port** ✅ | v1.93 engine + FX module + Simple mode; maxkit UI in phone and laptop layouts; keep the screen awake while playing (Screen Wake Lock), since mobile browsers pause audio when the screen locks. Done when it sounds like `and_justice.mp3`. |
| **2. Share** (capture, render, MP3 and save/share built; Roundware next) | Loop capture, offline render, MP3, Roundware v3 submit with location, built-in save/share. |
| **3. Advanced + reVox** | Advanced mode, grid editing, slice view, reVox browse / remix / credit. |
| **4. Improvements** | Craziness, swing, XY pad, word slicing, etc. |
| Later | Kiosk mode, performance mode (quad, MIDI). |

---

## 11. Risks
- **iOS audio:** audio only starts after a tap, and the silent switch can mute playback. The spike checks both.
- **Slicing quality** on cheap mics and in noisy rooms. Mitigated by the slicer test page and the noisy-room preset.
- **Privacy:** voices and location are personal. Mitigations: consent, reVox off by default, approximate location allowed.
- **Roundware v3 unknowns:** file formats, extra data per contribution, sharing functions. See Q1.

---

## 12. Open questions
1. **Roundware v3** (mapping in §6):
   - Does the text-attachment type accept `.json` files?
   - Could a project keep uploaded audio as-is (no FFmpeg conversion) for the `beatvox-source` voice?
   - The participant docs mention people who "made a loop": is there a v3 loop feature BeatVox should use?
   - Should a BeatVox share page live in this app, or use your Roundware app's `/share/<id>`?
2. **Slicing:** settled: Mixed is the default, all three methods stay as options. Still open: is the AGPL license on Essentia.js a problem (is BeatVox going to be open source anyway)?
3. **Waves settings:** do you remember roughly what the EQ and RVox did? Otherwise I'll tune by ear.
4. **Grid editing in 1.93:** could visitors toggle cells, or was the grid display only?
5. *(settled: Svelte; BeatVox talks to the v3 API directly and doesn't use the React Roundware app)*
6. **reVox defaults:** off by default with an opt-in checkbox. Is that right?
7. **Hosting / domain:** any preference?
