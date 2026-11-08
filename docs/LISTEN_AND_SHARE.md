# Listening and sharing: the template's pages, or our own?

*Draft for discussion, 8 Nov 2026. Nothing here is built or decided yet.*

BeatVox has its own Record / Listen / Share app. Two more pages are needed: the **map**, where you hear other people's BeatVoxes, and the **share page** for one BeatVox, the one a link opens. The Roundware web app template already has both, and project 103 is now published there (`beatvox.roundware.app`). The question is whether to use them, and how far to bend the template to fit.

Halsey's worry: too many BeatVox-specific details to put in a general template, and the look won't match without more customization. Both are fair. This plan treats it as an **experiment with an exit**: do the changes worth doing anyway, test the look, and stop at a clear decision point if it isn't working.

---

## 1. What the template does with a BeatVox today

Checked on the published site with the test BeatVox (voice #32653, mix #32654):

- **Map:** one marker per *parent* asset, so the marker is the raw voice. A link to the mix (`?aid=32654`) jumps to the voice, and its card plays only the 4-second voice. The beat isn't on the map at all.
- **Stream:** plays every audio asset once (voices and mixes alike), through `<audio>` with no loop.
- **Share page** (`/share/32654`): leads with the voice ("BeatVox Source Audio", 0:04), then the mix as an attachment, not looping. The two JSON files show as **audio players** (a bug).
- **Map view:** opens zoomed in on the project's centre in Kansas, so contributions elsewhere aren't visible.

---

## 2. What BeatVox needs, sorted

The key test for each item: **would another Roundware project want this?** If so, it belongs in the template as a project setting, and BeatVox is just the first project to use it. If not, it's BeatVox-only, and each of those is a cost of using the template.

### Worth doing in the template anyway (any project)

| # | Change | Size |
|---|---|---|
| 1 | Hide `data` attachments everywhere, grandchildren included (bug today) | small |
| 2 | Open the map fitted to the contributions, not zoomed in on the centre | small |
| 3 | **Loop setting:** assets with chosen tags loop, gapless (Web Audio) on the share page and in the card, and *n* times in the stream | medium |
| 4 | **What shows and plays, by tag:** for example, voices don't get markers or play in the stream; mixes do | small–medium |
| 5 | **Lead with the shared asset:** the share page and card play what was shared (the mix), with its parent as "made from" | medium |
| 6 | **External speak link:** "Add your voice" and Speak go to another app (`beatvox.org`) | small |

Items 3–6 are new settings, but they're general. A music project, a loop-based installation or a project with its own recorder could use any of them.

### Could be general, if worded generally

| # | BeatVox wants | General form |
|---|---|---|
| 7 | A **reVox** button on a card, opening BeatVox with that voice | A configurable action link with a pattern, like `sharing_url`: `https://beatvox.org/revox/[parent_id]` |
| 8 | The **constellation**: lines from a voice to all its mixes | "Draw lines from a parent to its children" on the map |
| 9 | Count of reVoxes per voice on its card | "Show how many children it has" |

### BeatVox-only (the real cost)

| # | Need | In the template? |
|---|---|---|
| 10 | Share page shows how the beat was made: style, BPM, "reVoxed from…", read from the recipe JSON | Only as BeatVox code. No general version |
| 11 | The retro Max look: yellow panels, pill buttons, the BEAT VOX header, LED-style meters | Partly, through custom CSS (below) |
| 12 | Play "your voice, then the beat" on the share page, as the saved MP3 does | Only as BeatVox code, or by uploading that file too |

So the list is mostly general. **Three items (10–12) are truly BeatVox-only**, and only one of them (the look) is essential to the experience.

---

## 3. The look: how far custom CSS goes

The template's Custom CSS (server doc 029) targets stable `rw-` class hooks on every part of the app: the header, the map controls, the card, the share page and each page's scope (`html.rw-page-share …`). BeatVox's look uses only system fonts (Arial, Courier New), which custom CSS can name without loading anything.

**Can probably be done in CSS:**
- colours and panels;
- pill-shaped buttons;
- Arial and Courier type;
- the header styling.

**Can't:**
- add elements (an LED meter, the BEAT VOX header as BeatVox draws it);
- change layout beyond what the template's structure allows;
- replace the Google map, which looks different from the Leaflet picker in BeatVox. Leaflet could become a template option, but that's a bigger change.

It's a genuine test of the white-labeling the template is aiming for. It's also where this approach is most likely to fall short.

---

## 4. The options

| | **A. Template, extended** | **B. All in BeatVox** | **C. Split** |
|---|---|---|---|
| Map | template | BeatVox (Svelte + Leaflet) | template |
| Share page | template | BeatVox | BeatVox |
| Template work | items 1–9 | none needed (1–6 still worth it for others) | 1–4, 6 |
| BeatVox work | none | map, stream, share page, link previews | share page, link previews |
| Look | as close as CSS gets | exactly BeatVox | share page exact; map styled by CSS |
| Addresses | `beatvox.org` + `map.beatvox.org/listen`, `/share/<id>` | all on `beatvox.org` | `beatvox.org/share/<id>`; map at `map.beatvox.org` |
| Biggest risk | look doesn't match; BeatVox code creeps into the template | rebuilding the stream: speakers, mixing, geo listening | two maps to keep similar |

Notes:
- **The stream is the hard part of B.** The framework (`roundware-web-framework`) does the mixing, asset pool and speakers, with no React dependency, so BeatVox could use it from Svelte. But it's **AGPL-3.0**, and using it in BeatVox would mean BeatVox's source is offered under the AGPL too, unless you, as the copyright holder, license it differently. Without the framework, a BeatVox map that simply plays one loop at a time is easy. A real Roundware stream is not.
- **Link previews** (iMessage, WhatsApp) for `/share/<id>` come from the server for the template's addresses. Under B or C, BeatVox needs its own: a small Netlify edge function that reads the asset and writes the page's `<title>` and Open Graph tags.
- **C fits the item list best:** the share page is where all three BeatVox-only items live (10–12), and the map needs only general changes.

---

## 5. Proposed experiment

1. **Template: items 1–4 and 6.** All general and small to medium, worth doing whichever option wins. Done on the test site (`beatvox-dev`), then live.
2. **Look test, time-boxed to an afternoon:** custom CSS on `beatvox-dev` to match BeatVox's look on the map and share page.
3. **Decision point.** Judge against these:
   - **No BeatVox-only code in the template**: every change is a setting another project could use.
   - **The CSS stays small**, uses only `rw-` hooks (no MUI class names, which break on updates), and the result reads as BeatVox.
   - **The share page feels like BeatVox**, or could with item 5 and the CSS.
4. **Then:**
   - all three met → **A**: do items 5 and 7–9 in the template;
   - map fine, share page not → **C**: BeatVox builds its share page;
   - map not fine either → **B**, or **C** with a simple BeatVox map.

Either way, steps 1–2 aren't wasted: the template gains general features, and the look test shows how far the white-labeling goes.

---

## 6. Halsey's answers (8 Nov 2026)

1. **Domain:** probably `beatvox.halseyburgund.com`.
2. **Licenses:** Halsey owns everything and can license as needed, so the AGPL isn't a blocker.
3. **Raw voices:** on the map somehow, approach open. The **constellation is important**, which suggests BeatVox needs full control of the map.
4. **No stream:** with no common tempo and huge variety, mixing contributions together makes no sense. How people should browse and listen is still open. **"Add your own reVox" from any contribution must be easy.**

**What this points to:** option **B** (BeatVox's own map and share page). No stream removes the hardest part of B, and the constellation and reVox needs are BeatVox-specific map features. The general template items (1–4, 6) stay worth doing for other projects, but BeatVox no longer depends on them. To settle after the UI/UX redesign, which comes first.

## 7. Open questions (as first asked)

1. **Domain:** what will BeatVox's address be (`beatvox.org`?), and is project 103 on a paid plan? Custom URLs and custom CSS both need one.
2. **AGPL:** is it acceptable for BeatVox to use the framework (option B), or should BeatVox stay clear of it?
3. **Raw voices on the map:** never shown, or shown as the centre of each constellation (item 8)?
4. **The stream:** should listening on the map play mixes the way Roundware usually does (several at once, by location), or one BeatVox at a time like a jukebox? This affects how much the template's stream suits BeatVox at all.
