# BeatVox (web)

Rebuild of BeatVox v1.93 (Max/MSP, 2009) as a web app. See [PROPOSAL.md](PROPOSAL.md).

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:5173/slicer.html for the **slicer lab**:
- compares the Attacks, Syllables and Mixed slicers on the 2008 reference recordings in `docs/beatvox-reference/`, or on a dropped file or a mic recording;
- click a slice to hear it, play the slices in order, or run a beat preview;
- tune the parameters (saved in your browser);
- mark the best method per recording and export your picks.

The reference recordings are served by a dev-only plugin (`dev/referenceAudio.ts`) and are never part of a build.
On a phone, the mic needs HTTPS (or localhost). Over your network, run `npm run dev -- --host` and use a tunnel or a self-signed certificate.

## Tests

```bash
npm test
```

## Phone testing (deployed lab)

The slicer lab is deployed at https://beatvox-lab.netlify.app/slicer.html (HTTPS, so the phone mic works). Redeploy with:

    npm run deploy

The deployed build has no reference recordings — those are served only by the local dev server.
