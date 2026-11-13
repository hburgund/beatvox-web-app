# BeatVox copy

Every piece of text a visitor can see (or hear read out by a screen reader) in the BeatVox web app, in the order a visitor meets it.

## How to use this file

- **Rewrite the text after the `>`** in your own words. Leave anything you're happy with untouched.
- **To cut something**, replace its text with `CUT`.
- **To leave a question or a note for Claude**, add a line starting `NOTE:` under the item.
- **Don't edit** the `<!-- … -->` source comments or the "When:" lines. They're how your edits get put back in the code.
- **Things in `{curly braces}`** are filled in by the app (a name, a number, a link). Keep them, but you can move them around in the sentence or drop them.
- **Markup:** `**bold**` is bold, `[text](link)` is a link, and ` / ` is a line break. Keep that form if you want it to stay.
- **Short labels must stay short.** Buttons are marked "(button)". Where I could tell from the layout, there's a rough count of how many characters fit on a phone, e.g. "(button, ~10 chars)". Most buttons are set in Courier Prime at 14px, about 9 px a character, on a phone screen about 340 px wide.
- **"(screen reader)"** marks text that's only read aloud to blind and low-vision visitors (it isn't shown). It should say plainly what a control does.
- **One item per distinct string.** If the same words appear in several places, they're listed once and the comment lists every place. Changing it changes all of them. If you want one of them to say something different, add a `NOTE:`.

---

## 1. Link previews and site identity

What iMessage, WhatsApp, Slack, etc. show when someone pastes a BeatVox link, plus the browser tab and the "add to home screen" name.

### Browser tab and home screen

- **When:** The name of the site: the browser tab's title on every page before anything else loads; the app's name (full and short) when someone adds BeatVox to their home screen; the site name some apps show above a link preview; and the tab title after About closes if the page had none. Also the name of the first style in the studio's STYLE menu (if you want the style called something else, add a NOTE)  <!-- index.html:11, public/site.webmanifest:2, public/site.webmanifest:3, src/lib/preview.ts:118, src/about/About.svelte:27, src/styles/01-beatvox.json:4 -->
  > BeatVox

- **When:** The app's one-line description in the home-screen manifest (some phones show it when installing)  <!-- public/site.webmanifest:4 -->
  > Putting rhythm into your voice.

### Link preview for the map (beatvox.app)

- **When:** Preview title when someone shares a link to the map (the home page)  <!-- src/lib/preview.ts:27 -->
  > BeatVox: putting rhythm into your voice

- **When:** Preview description under that title  <!-- src/lib/preview.ts:28 -->
  > Explore the globe filled with beats made from people’s voices. Then create and contribute your own.

### Link preview for the studio (beatvox.app/studio)

- **When:** Preview title when someone shares a link to the studio  <!-- src/lib/preview.ts:31 -->
  > Make a BeatVox

- **When:** Preview description under that title  <!-- src/lib/preview.ts:32 -->
  > Record anything for up to 15 seconds and BeatVox slices it into a beat. Refine your creation, share it and add it to the map.

### Link preview for About (beatvox.app/about)

- **When:** Preview title when someone shares a link to the About page. Also what a screen reader says for the round "?" button on every page  <!-- src/lib/preview.ts:35, src/about/AboutButton.svelte:6 -->
  > About BeatVox

- **When:** Preview description under that title  <!-- src/lib/preview.ts:36 -->
  > What is BeatVox? How does it work and who made it?

### The site's preview picture

- **When:** (screen reader) Description of the site's preview picture, on the map, studio and About previews  <!-- src/lib/preview.ts:50 -->
  > BeatVox: a beat grid and a yellow play button

The picture itself (`public/og/beatvox.png`) is drawn from `dev/og-card.html`. Changing these means re-rendering that picture, so mention it in a `NOTE:` if you change them.

- **When:** The tagline. Big heading on the welcome card on a first visit to the map, the heading at the top of About, and the big tagline on the site's preview picture. The " / " is a line break  <!-- src/map/Welcome.svelte:24, src/about/AboutContent.svelte:21, dev/og-card.html (class="tag") -->
  > Putting rhythm / into your voice.

- **When:** Smaller text under the tagline on the site's preview picture  <!-- dev/og-card.html (class="sub") -->
  > Record a short clip. / BeatVox slices it into a beat. / Play, refine and share it on the global map.
  NOTE: need to remake the image with new text.

- **When:** The web address on the site's preview picture, and on the share videos (bottom right of the square one, top of the tall one, and in a box on the end card)  <!-- dev/og-card.html (class="url"), src/lib/video/script.ts:12 -->
  > beatvox.app

### Link preview for one BeatVox's own page (beatvox.app/b/…)

- **When:** Preview title for a named BeatVox. {name} is the name its maker gave it  <!-- src/lib/preview.ts:103 -->
  > {name} · a BeatVox

- **When:** Preview title for a named reVox (a beat made from someone else's voice)  <!-- src/lib/preview.ts:103 -->
  > {name} · a reVox

- **When:** Preview title for a BeatVox nobody named. Also the name an unnamed beat gets everywhere on the site (map, its sheet, its page, lists)  <!-- src/lib/preview.ts:103, src/lib/mapData.ts:130, src/lib/shared.ts:155 -->
  > A BeatVox

- **When:** Preview title for a reVox nobody named  <!-- src/lib/preview.ts:103 -->
  > A reVox of BeatVox

- **When:** Preview description for a BeatVox  <!-- src/lib/preview.ts:106 -->
  > A voice with rhythm added! Listen and make your own with BeatVox.

- **When:** Preview description for a reVox  <!-- src/lib/preview.ts:105 -->
  > A voice with rhythm added! Listen and make your own with BeatVox.

- **When:** (screen reader) Description of a BeatVox's preview picture (its animated ring)  <!-- src/lib/preview.ts:132 -->
  > {title}: the beat drawn as a ring

---

## 2. The map (home page)

### Welcome card (first visit only)

Pops up from the bottom on someone's first visit to the map. Shown once.

The welcome card's heading, "Putting rhythm / into your voice.", is listed in section 1.

- **When:** (screen reader) The X button in the welcome card's corner. Also the X on the filter panel and on a beat's sheet on the map  <!-- src/map/Welcome.svelte:25, src/map/MapPage.svelte:466, src/map/MixDetail.svelte:67 -->
  > Close

- **When:** The paragraph under the welcome heading  <!-- src/map/Welcome.svelte:29 -->
  > Every dot on this map is a beat someone made from a few seconds of their voice. BeatVox slices the voice into chunks and plays them like a drum machine.

- **When:** Small caption under the first of three little pictures (a waveform)  <!-- src/map/Welcome.svelte:36 -->
  > YOUR VOICE

- **When:** Small caption under the second little picture (the waveform cut in three)  <!-- src/map/Welcome.svelte:43 -->
  > SLICED

- **When:** Small caption under the third little picture (a beat clock)  <!-- src/map/Welcome.svelte:51 -->
  > A BEAT

- **When:** Yellow button on the welcome card: starts playing beats one after another (button, ~13 chars)  <!-- src/map/Welcome.svelte:57 -->
  > LISTEN

- **When:** Pink button on the welcome card, and pink button top right of the map: opens the studio (button, ~10 chars in the map header, which is already full on a phone)  <!-- src/map/Welcome.svelte:59, src/map/MapPage.svelte:386 -->
  > MAKE YOURS

- **When:** Small grey line under the two welcome buttons  <!-- src/map/Welcome.svelte:61 -->
  > LISTEN plays beats from around the world, one after another.

- **When:** Link at the bottom of the welcome card: opens About  <!-- src/map/Welcome.svelte:62 -->
  > What is BeatVox? About the project →

### Map page header and map

- **When:** The wordmark: top left of the map, the studio (with four little beat lights beside it) and a BeatVox's page (where it links to the map). Also painted on the share videos (top, and big on the end card) and on the animated GIF / link preview picture  <!-- src/map/MapPage.svelte:379, src/app/App.svelte:60, src/share/SharePage.svelte:104, src/lib/video/draw.ts:316, src/lib/video/draw.ts:329, src/lib/video/draw.ts:392, src/lib/card.ts:105, src/lib/card.ts:107 -->
  > BEATVOX

- **When:** The round "?" button next to the wordmark on every page (map, studio, a BeatVox's page): opens About  <!-- src/about/AboutButton.svelte:6 -->
  > ?

Its screen-reader name, "About BeatVox", is listed in section 1.

- **When:** Button top right of the map that opens the filters. When some are ticked it becomes "FILTER · 2" and so on. Also the heading of the filter panel (button, ~10 chars including the count)  <!-- src/map/MapPage.svelte:384, src/map/MapPage.svelte:465 -->
  > FILTER

- **When:** What's added to the FILTER button when filters are ticked; {n} is how many  <!-- src/map/MapPage.svelte:384 -->
  > · {n}

- **When:** (screen reader) The map itself  <!-- src/map/MapPage.svelte:391 -->
  > Map of BeatVoxes

- **When:** (screen reader) The pair of +/− buttons on the map  <!-- src/map/MapPage.svelte:392 -->
  > Zoom

- **When:** (screen reader) The + button  <!-- src/map/MapPage.svelte:393 -->
  > Zoom in

- **When:** (screen reader) The − button  <!-- src/map/MapPage.svelte:396 -->
  > Zoom out

- **When:** (screen reader) A dot on the map whose sheet is open. {title} is the beat's name (a dot that isn't open just reads its name, which also shows as a tooltip on a computer)  <!-- src/map/MapPage.svelte:228 -->
  > {title} (open)

- **When:** Note at the bottom while the map loads  <!-- src/map/MapPage.svelte:405 -->
  > Loading the map…

- **When:** Note at the bottom if the beats can't be loaded  <!-- src/map/MapPage.svelte:156 -->
  > Couldn't reach the BeatVox server. Check your connection and reload.

### Wander bar (along the bottom of the map)

- **When:** Button bottom left: plays beats one after another and flies the map to each (button, ~8 chars)  <!-- src/map/MapPage.svelte:413 -->
  > WANDER

- **When:** The same button while wandering. Also: the record button while recording, the HEAR IT button while your voice plays back in the studio, and the button in About's "now playing" line (button, ~6 chars)  <!-- src/map/MapPage.svelte:411, src/app/VoiceCard.svelte:69, src/app/VoiceCard.svelte:82, src/about/About.svelte:69 -->
  > STOP

- **When:** (screen reader) Round button next to STOP while wandering, to start this beat again  <!-- src/map/MapPage.svelte:417 -->
  > Replay this one

- **When:** Tooltip on that button (shown on hover on a computer)  <!-- src/map/MapPage.svelte:417 -->
  > Replay

- **When:** (screen reader) Round button next to it while wandering, to go on to the next beat  <!-- src/map/MapPage.svelte:420 -->
  > Skip to the next one

- **When:** Tooltip on that button (shown on hover on a computer)  <!-- src/map/MapPage.svelte:420 -->
  > Skip

- **When:** (screen reader) The two-way switch beside WANDER  <!-- src/map/MapPage.svelte:424 -->
  > Wander through

- **When:** Left half of the switch: wander through every beat (small toggle, ~8 chars)  <!-- src/map/MapPage.svelte:425 -->
  > ANYWHERE

- **When:** Right half of the switch: wander only through beats made from the same voice; greyed out until a beat is picked (small toggle, ~8 chars)  <!-- src/map/MapPage.svelte:426 -->
  > THIS VOX

- **When:** Word after the count at the right end of the bar ("1 BEAT") when exactly one beat shows. Also in the strip under the small map on a BeatVox's page, and the label top left of the studio's beat card  <!-- src/map/MapPage.svelte:428, src/share/SharePage.svelte:190, src/app/BeatCard.svelte:19 -->
  > BEAT

- **When:** The same word for any other number ("23 BEATS"). Also in the strip under the small map on a BeatVox's page  <!-- src/map/MapPage.svelte:428, src/share/SharePage.svelte:190 -->
  > BEATS

### Filter panel (from the FILTER button)

- **When:** (screen reader) The filter panel  <!-- src/map/MapPage.svelte:463 -->
  > Filter the map

- **When:** Heading of the group of checkboxes for the kind of beat  <!-- src/lib/mapData.ts:98, src/lib/mapData.ts:100 -->
  > KIND

- **When:** Checkbox in KIND: beats made from the maker's own voice  <!-- src/lib/mapData.ts:47 -->
  > Original BeatVoxes

- **When:** Checkbox in KIND: beats made from someone else's voice  <!-- src/lib/mapData.ts:48 -->
  > ReVoxes

- **When:** Heading of the reVox group of checkboxes in the map's filters (only if it isn't already in another group). Also the label top left of the studio's voice card when you're using someone else's voice  <!-- src/lib/mapData.ts:102, src/app/VoiceCard.svelte:43 -->
  > REVOX

- **When:** Checkbox: only voices their makers let others reVox  <!-- src/lib/mapData.ts:49 -->
  > Can be reVoxed

- **When:** Small note under the checkboxes  <!-- src/map/MapPage.svelte:478 -->
  > Nothing checked in a group shows all of it.

- **When:** Link bottom left of the filter panel: unticks everything  <!-- src/map/MapPage.svelte:480 -->
  > clear

- **When:** Button bottom right of the filter panel: closes it; {n} is how many beats the filters leave (button)  <!-- src/map/MapPage.svelte:481 -->
  > SHOW {n}

(From Claude: any other filter groups and checkboxes come from the Roundware project's tags and UI groups on the server, not from the code, so they aren't listed here. Group names are shown in capitals.)

### A beat's sheet on the map (tap a dot)

On a phone this rises from the bottom; on a computer it's a panel on the right.

- **When:** (screen reader) The sheet itself; {title} is the beat's name  <!-- src/map/MapPage.svelte:432 -->
  > {title}: details

- **When:** Under a reVox's name (on the map sheet and on its own page): names the beat whose voice it uses; {title} is tappable and goes to that beat  <!-- src/map/MixDetail.svelte:65, src/share/SharePage.svelte:138 -->
  > made with the vox from {title}

- **When:** In the sheet if the beat can't be loaded  <!-- src/map/MixDetail.svelte:73 -->
  > Couldn't load this BeatVox. Check your connection and try again.

- **When:** In the sheet if the beat has been taken down or isn't on the map yet  <!-- src/map/MixDetail.svelte:75 -->
  > This BeatVox isn't available right now.

- **When:** (screen reader) The beat drawn as a ring of squares  <!-- src/lib/ui/Ring.svelte:21, src/map/MixDetail.svelte:78 -->
  > The beat as a circle

- **When:** (screen reader) The play button in the middle of the ring (map sheet) and the round play button in the studio, while it's playing  <!-- src/map/MixDetail.svelte:82, src/app/BeatCard.svelte:65 -->
  > Stop the beat

- **When:** (screen reader) The same play button when it's stopped (map sheet, studio, and a BeatVox's own page)  <!-- src/map/MixDetail.svelte:82, src/app/BeatCard.svelte:65, src/share/SharePage.svelte:152 -->
  > Play the beat

- **When:** Small line under the ring while wandering  <!-- src/map/MixDetail.svelte:99 -->
  > Wandering: the next one starts when this one ends.

- **When:** (screen reader) Small play button beside "THE SOURCE VOX", while the voice plays (map sheet and a BeatVox's page)  <!-- src/map/MixDetail.svelte:105, src/share/SharePage.svelte:174 -->
  > Stop the source vox

- **When:** (screen reader) The same button when stopped  <!-- src/map/MixDetail.svelte:105, src/share/SharePage.svelte:174 -->
  > Hear the source vox

- **When:** Label beside that small play button (map sheet and a BeatVox's page)  <!-- src/map/MixDetail.svelte:116, src/share/SharePage.svelte:182 -->
  > THE SOURCE VOX

- **When:** Small line under "THE SOURCE VOX" on the map sheet  <!-- src/map/MixDetail.svelte:117 -->
  > the recording these beats are made from

- **When:** Heading over the row of other beats made from the same voice (only if there's more than one); {n} is how many  <!-- src/map/MixDetail.svelte:123 -->
  > THIS VOX · {n} BEATS

- **When:** (screen reader) A small round play button for one of those beats, while it plays; {title} is its name (map sheet and a BeatVox's page)  <!-- src/map/MixDetail.svelte:134, src/share/SharePage.svelte:238 -->
  > Stop {title}

- **When:** (screen reader) The same small button when stopped  <!-- src/map/MixDetail.svelte:134, src/share/SharePage.svelte:238 -->
  > Play {title}

- **When:** Button at the bottom of the sheet: opens the beat's own page (button, ~16 chars)  <!-- src/map/MixDetail.svelte:145 -->
  > OPEN ITS PAGE

- **When:** Pink button beside it, when the maker lets others use their voice: opens the studio with this voice. Also the big button at the bottom of a BeatVox's page (button, ~16 chars)  <!-- src/map/MixDetail.svelte:147, src/share/SharePage.svelte:202 -->
  > REVOX THIS VOX

- **When:** Pink button in the same spot when the voice can't be reVoxed; also on a BeatVox's page (bottom bar, and under "waiting for processing" / "not found"): opens the studio. Also the small label in the box on the share videos' end card (button, ~16 chars)  <!-- src/map/MixDetail.svelte:149, src/share/SharePage.svelte:125, src/share/SharePage.svelte:132, src/share/SharePage.svelte:205, src/lib/video/draw.ts:415 -->
  > MAKE YOUR OWN

### LIKE and FLAG (under the ring, on the map sheet and on a BeatVox's page)

- **When:** Button under the ring, before you've liked it (button, ~9 chars)  <!-- src/lib/ui/Votes.svelte:70 -->
  > LIKE

- **When:** The same button after you've liked it (it can't be undone)  <!-- src/lib/ui/Votes.svelte:70 -->
  > LIKED

- **When:** Button beside LIKE, to report a beat (button, ~9 chars)  <!-- src/lib/ui/Votes.svelte:76 -->
  > FLAG

- **When:** The same button after you've flagged it  <!-- src/lib/ui/Votes.svelte:76 -->
  > FLAGGED

- **When:** (screen reader) The little "are you sure?" box that opens when you tap FLAG  <!-- src/lib/ui/Votes.svelte:81 -->
  > Flag this BeatVox

- **When:** The question in that box  <!-- src/lib/ui/Votes.svelte:82 -->
  > Flag this BeatVox for review? For anything hateful or abusive, or a voice or recording used without permission.

- **When:** Pink button in that box that sends the flag (button)  <!-- src/lib/ui/Votes.svelte:84 -->
  > FLAG IT

- **When:** Link beside it that closes the box without flagging  <!-- src/lib/ui/Votes.svelte:85 -->
  > cancel

- **When:** Small note after the flag has gone through  <!-- src/lib/ui/Votes.svelte:53 -->
  > Thanks. It will be reviewed.

- **When:** Small note if the like didn't go through  <!-- src/lib/ui/Votes.svelte:36 -->
  > Couldn't send your like. Check your connection and try again.

- **When:** Small note if the flag didn't go through  <!-- src/lib/ui/Votes.svelte:54 -->
  > Couldn't send the flag. Check your connection and try again.

---

## 3. The studio (beatvox.app/studio)

### Header

The BEATVOX wordmark and the "?" button are listed under the map page header.

- **When:** Button top right of the studio: back to the map. Also top right of a BeatVox's own page (button, ~6 chars)  <!-- src/app/App.svelte:64, src/share/SharePage.svelte:107 -->
  > MAP

### Voice card: before recording

- **When:** (screen reader) The top card, where you record  <!-- src/app/VoiceCard.svelte:41 -->
  > Voice

- **When:** Label top left of the voice card  <!-- src/app/VoiceCard.svelte:43 -->
  > VOICE

- **When:** Small grey text top right of the voice card before you've recorded. {MAX_RECORD_SEC} is 15  <!-- src/app/VoiceCard.svelte:15 -->
  > UP TO {MAX_RECORD_SEC} S

- **When:** The paragraph above the record button before you've recorded. {MAX_RECORD_SEC} is 15  <!-- src/app/VoiceCard.svelte:77 -->
  > Say anything for up to {MAX_RECORD_SEC} seconds: your name, a word, a beatbox. BeatVox cuts it into slices and makes a beat.

- **When:** The big record button (button, ~8 chars)  <!-- src/app/VoiceCard.svelte:82 -->
  > RECORD

- **When:** (screen reader) The big record button, before recording  <!-- src/app/VoiceCard.svelte:80 -->
  > Start recording

- **When:** Small text under the big countdown number, before recording  <!-- src/app/VoiceCard.svelte:86 -->
  > seconds to record

- **When:** Checkbox under the record button: turns on the phone's noise reduction  <!-- src/app/VoiceCard.svelte:94 -->
  > noisy room

### Voice card: while recording

- **When:** Small grey text top right of the voice card while recording  <!-- src/app/VoiceCard.svelte:12 -->
  > RECORDING…

- **When:** (screen reader) The big record button while recording (it shows STOP, listed above)  <!-- src/app/VoiceCard.svelte:80 -->
  > Stop recording

- **When:** Small text under the big countdown number while recording  <!-- src/app/VoiceCard.svelte:86 -->
  > seconds left

### Voice card: problems recording

These show as a small line at the bottom of the voice card.

- **When:** The browser wouldn't open the microphone (permission refused, no mic…). {error} is the browser's own explanation, in English  <!-- src/app/session.svelte.ts:231 -->
  > Couldn't open the microphone ({error}).

- **When:** The recording was under half a second  <!-- src/app/session.svelte.ts:246 -->
  > That was very short. Try again.

- **When:** The recording was too quiet to cut into at least two slices  <!-- src/app/session.svelte.ts:303 -->
  > Not much to slice there. Try speaking a bit louder!

### Voice card: after recording

- **When:** Small grey text top right of the voice card once there's a voice: its length in seconds and how many slices  <!-- src/app/VoiceCard.svelte:14 -->
  > {seconds} S · {n} SLICES

- **When:** (screen reader) The blue waveform of your voice; {n} is how many slices  <!-- src/lib/ui/Wave.svelte:177 -->
  > Your voice, cut into {n} slices. Tap a slice to hear it; drag it onto a beat row.

- **When:** Little tag that follows your finger while you drag a slice from the waveform; {n} is its number  <!-- src/lib/ui/Wave.svelte:182 -->
  > SLICE {n}

- **When:** Small tip under the waveform  <!-- src/app/VoiceCard.svelte:64 -->
  > Tap a slice to hear it. Drag it onto a beat row to play it there.

- **When:** Button under the waveform: record again (button, ~14 chars, it shares the row with HEAR IT)  <!-- src/app/VoiceCard.svelte:66 -->
  > RE-RECORD

- **When:** Button beside it: play your recording back. While it plays, it shows STOP (listed above) (button, ~14 chars)  <!-- src/app/VoiceCard.svelte:71 -->
  > HEAR IT

### Voice card: a reVox (someone else's voice, from REVOX THIS VOX)

The voice card's label for a reVox, "REVOX", is listed with the map's filters.

- **When:** While their voice loads  <!-- src/app/VoiceCard.svelte:51 -->
  > Loading the vox…

- **When:** Paragraph at the top of the voice card once their voice is in. {title} is a link to the beat it came from  <!-- src/app/VoiceCard.svelte:47 -->
  > The vox from [{title}](/b/{mixId}), with its beat to start from. Change the beat, make a new one, then save and send yours.

- **When:** Button under the waveform in a reVox, instead of RE-RECORD: switch to recording your own voice (button, ~14 chars)  <!-- src/app/VoiceCard.svelte:66 -->
  > RECORD YOURS

- **When:** The link pointed at a beat that isn't on the map yet (still processing)  <!-- src/app/session.svelte.ts:337 -->
  > That BeatVox is still processing, so its vox can't be reVoxed yet.

- **When:** The link pointed at a beat that doesn't exist  <!-- src/app/session.svelte.ts:337 -->
  > Couldn't find that BeatVox.

- **When:** The maker didn't allow reVoxing  <!-- src/app/session.svelte.ts:341 -->
  > The maker kept that vox to themselves. Record your own instead!

- **When:** Their voice couldn't be downloaded  <!-- src/app/session.svelte.ts:354 -->
  > Couldn't load that vox. Check your connection and try again.

### Beat card: top row

- **When:** (screen reader) The beat card. Also the bold word of step 3 in About's "How it works"  <!-- src/app/BeatCard.svelte:17, src/about/AboutContent.svelte:13 -->
  > Beat

The beat card's label, "BEAT", is listed with the map's wander bar.

- **When:** Small button beside BEAT: swaps the boxes for a volume bar per row (button, ~5 chars; three of these share the row)  <!-- src/app/BeatCard.svelte:20 -->
  > MIX

- **When:** Small button beside MIX: adds a pattern menu to each row (button, ~7 chars)  <!-- src/app/BeatCard.svelte:21 -->
  > PATTERN

- **When:** Small button beside PATTERN: swaps the boxes for left–right placement bars (button, ~5 chars)  <!-- src/app/BeatCard.svelte:22 -->
  > PAN

- **When:** Small label in front of the style menu  <!-- src/app/BeatCard.svelte:24 -->
  > STYLE

- **When:** First choice in the style menu: a random beat, not from a style  <!-- src/app/BeatCard.svelte:26 -->
  > Random

- **When:** How a style is written in the style menu: its name, then how many beats it has, e.g. "House (10)"  <!-- src/app/BeatCard.svelte:27 -->
  > {style} ({n})

- **When:** Line above the grid when a style's beat is playing, e.g. "House: **Deep** · 2 of 10. NEW BEAT plays another."  <!-- src/app/BeatCard.svelte:32 -->
  > {style}: **{beat}** · {number} of {n}. NEW BEAT plays another.

The style names and the names of their beats are listed further down, under "Style and beat names".

### Beat card: hints under the grid

- **When:** Under the empty grid, before there's a voice  <!-- src/app/BeatCard.svelte:52 -->
  > Your beat shows up here. Tap a box to add or remove a hit.

- **When:** Under the grid in the MIX view  <!-- src/app/BeatCard.svelte:54 -->
  > Drag along a row to set its level. Tap MIX to go back to the boxes.

- **When:** Under the grid in the PAN view  <!-- src/app/BeatCard.svelte:56 -->
  > FIXED: drag to place a row anywhere from left to right. ROAM: drag the two ends, and the row wanders between them. Tap PAN to go back.

- **When:** Under the grid in the PATTERN view  <!-- src/app/BeatCard.svelte:58 -->
  > Pick a pattern for any row from its menu. Evolve leaves those rows alone. Tap PATTERN to put the menus away.

### Beat card: the grid

Each row starts with its slice number (tap it to rest or wake the row).

- **When:** (screen reader) The whole grid  <!-- src/lib/ui/Grid.svelte:71 -->
  > Beat: {playing} of {rows} slices playing

- **When:** (screen reader) The slice number at the start of a row; the middle part says "playing" or "resting" (next two items)  <!-- src/lib/ui/Grid.svelte:80 -->
  > Row {row} plays slice {slice}, {playing|resting}, level {percent}%

- **When:** (screen reader) Word in the item above when the row is on  <!-- src/lib/ui/Grid.svelte:80 -->
  > playing

- **When:** (screen reader) Word in the item above when the row is resting  <!-- src/lib/ui/Grid.svelte:80 -->
  > resting

- **When:** (screen reader) One box in the grid  <!-- src/lib/ui/Grid.svelte:127 -->
  > Row {row}, step {step}

### Beat card: PATTERN view menus

A small menu slides in at the start of each row. These are very narrow, about 4 characters.

- **When:** (screen reader) A row's pattern menu  <!-- src/lib/ui/Grid.svelte:90 -->
  > Row {row} pattern

- **When:** What the menu shows when the row's hits don't match any pattern  <!-- src/lib/ui/Grid.svelte:98 -->
  > ···

- **When:** Pattern menu choice: a hit on every step  <!-- src/lib/ui/Grid.svelte:40 -->
  > 1/16

- **When:** Pattern menu choice: every other step  <!-- src/lib/ui/Grid.svelte:41 -->
  > 1/8

- **When:** Pattern menu choice: every beat  <!-- src/lib/ui/Grid.svelte:42 -->
  > 1/4

- **When:** Pattern menu choice: every other beat  <!-- src/lib/ui/Grid.svelte:43 -->
  > 1/2

- **When:** Pattern menu choice: the off-beats (upbeats)  <!-- src/lib/ui/Grid.svelte:44 -->
  > UP

- **When:** Pattern menu choice: a random pattern  <!-- src/lib/ui/Grid.svelte:45 -->
  > RND

- **When:** Pattern menu choice: no hits  <!-- src/lib/ui/Grid.svelte:46 -->
  > none

- **When:** Extra pattern menu choice after RND, to roll a new random pattern  <!-- src/lib/ui/Grid.svelte:100 -->
  > RND again

### Beat card: MIX view

- **When:** (screen reader) A row's volume bar in the MIX view (the number beside it is its level, 0–100)  <!-- src/lib/ui/Grid.svelte:105 -->
  > Row {row} level

### Beat card: PAN view

- **When:** Small button at the start of a row in the PAN view: the row stays in one place (tap to switch to ROAM) (button, ~5 chars)  <!-- src/lib/ui/PanBar.svelte:69 -->
  > FIXED

- **When:** The same button when the row wanders between two points  <!-- src/lib/ui/PanBar.svelte:69 -->
  > ROAM

- **When:** (screen reader) The base name of a row's pan controls, used in the items below  <!-- src/lib/ui/Grid.svelte:112 -->
  > Row {row} pan

- **When:** (screen reader) The FIXED/ROAM button; {label} is "Row 1 pan" etc., and the next two items fill in the gaps  <!-- src/lib/ui/PanBar.svelte:68 -->
  > {label}: {fixed in place|roaming}. Switch to {roam|fixed}

- **When:** (screen reader) Words in the item above for a FIXED row  <!-- src/lib/ui/PanBar.svelte:68 -->
  > fixed in place

- **When:** (screen reader) Words in the item above for a ROAM row  <!-- src/lib/ui/PanBar.svelte:68 -->
  > roaming

- **When:** (screen reader) Word in the item above, what a tap switches a FIXED row to  <!-- src/lib/ui/PanBar.svelte:68 -->
  > roam

- **When:** (screen reader) Word in the item above, what a tap switches a ROAM row to  <!-- src/lib/ui/PanBar.svelte:68 -->
  > fixed

- **When:** (screen reader) The one handle on a FIXED row  <!-- src/lib/ui/PanBar.svelte:76 -->
  > {label} position

- **When:** (screen reader) The left handle on a ROAM row  <!-- src/lib/ui/PanBar.svelte:79 -->
  > {label} roams from

- **When:** (screen reader) The right handle on a ROAM row  <!-- src/lib/ui/PanBar.svelte:80 -->
  > {label} roams to

- **When:** (screen reader) Where a handle is, when it's in the middle  <!-- src/lib/ui/PanBar.svelte:25 -->
  > centre

- **When:** (screen reader) Where a handle is, off to one side; {left|right} is the next two items, {n} 1–100  <!-- src/lib/ui/PanBar.svelte:25 -->
  > {left|right} {n}

- **When:** (screen reader) Word in the item above  <!-- src/lib/ui/PanBar.svelte:25 -->
  > left

- **When:** (screen reader) Word in the item above  <!-- src/lib/ui/PanBar.svelte:25 -->
  > right

### Beat card: buttons under the grid

The round yellow play button's screen-reader names, "Play the beat" / "Stop the beat", are listed under the map's beat sheet.

- **When:** Button beside the play button: a whole new beat (button, ~8 chars; three share the row with the play button)  <!-- src/app/BeatCard.svelte:74 -->
  > NEW BEAT

- **When:** Button beside it: changes the beat a little (button, ~8 chars)  <!-- src/app/BeatCard.svelte:75 -->
  > EVOLVE

- **When:** Button beside it: gives every playing row a different slice (button, ~8 chars)  <!-- src/app/BeatCard.svelte:76 -->
  > RE-SLICE

- **When:** Checkbox under the buttons: the beat changes by itself every few bars  <!-- src/app/BeatCard.svelte:80 -->
  > keep evolving

- **When:** (screen reader) The undo arrow  <!-- src/app/BeatCard.svelte:82 -->
  > Undo

- **When:** Tooltip on the undo arrow (on a computer)  <!-- src/app/BeatCard.svelte:82 -->
  > Undo (⌘Z)

- **When:** (screen reader) The redo arrow  <!-- src/app/BeatCard.svelte:87 -->
  > Redo

- **When:** Tooltip on the redo arrow (on a computer)  <!-- src/app/BeatCard.svelte:87 -->
  > Redo (⇧⌘Z)

### Beat card: dials

Five small dials in a row; each name sits under its dial. Very short: about 6 characters.

- **When:** Dial name: volume  <!-- src/app/BeatCard.svelte:96 -->
  > Vol

- **When:** Dial name: speed (beats per minute)  <!-- src/app/BeatCard.svelte:97 -->
  > Tempo

- **When:** Dial name: how high or low the voice plays  <!-- src/app/BeatCard.svelte:98 -->
  > Pitch

- **When:** Dial name: reverb and echo  <!-- src/app/BeatCard.svelte:99 -->
  > Space

- **When:** Dial name: how much each hit varies, like a human player  <!-- src/app/BeatCard.svelte:100 -->
  > Human

### Save bar (along the bottom of the studio)

- **When:** Pink button bottom left of the studio: records the next 8 bars of the beat. {SHARE_LOOPS} is 8 (button, ~14 chars)  <!-- src/app/SaveBar.svelte:48 -->
  > SAVE {SHARE_LOOPS} BARS

- **When:** Small text beside that button  <!-- src/app/SaveBar.svelte:50 -->
  > Starts on the next downbeat. Keep playing while it saves.

- **When:** Bar's title after tapping SAVE, until the next bar starts  <!-- src/app/SaveBar.svelte:16 -->
  > STARTS ON THE NEXT DOWNBEAT…

- **When:** Bar's title while saving; {bar} counts up to {SHARE_LOOPS} (8)  <!-- src/app/SaveBar.svelte:18 -->
  > SAVING · BAR {bar} OF {SHARE_LOOPS}

- **When:** Bar's title after the 8 bars, while the MP3 is made  <!-- src/app/SaveBar.svelte:19 -->
  > MIXING YOUR LOOP…

- **When:** Small button at the right while it waits or saves (button, ~8 chars)  <!-- src/app/SaveBar.svelte:29 -->
  > CANCEL

- **When:** (screen reader) The row of 8 little boxes that fill in as bars are saved  <!-- src/app/SaveBar.svelte:32 -->
  > Bars saved

- **When:** Pink button once it's saved: opens the share sheet (button, ~14 chars)  <!-- src/app/SaveBar.svelte:41 -->
  > SHARE

- **When:** Small text beside SHARE; {SHARE_LOOPS} is 8  <!-- src/app/SaveBar.svelte:44 -->
  > {SHARE_LOOPS} bars saved.

- **When:** Link under that: throw this away and save another 8 bars  <!-- src/app/SaveBar.svelte:45 -->
  > save again

- **When:** Shown beside the save button, in red, if the beat was stopped while saving  <!-- src/app/session.svelte.ts:654 -->
  > The beat stopped before the capture finished. Try again.

- **When:** Shown beside the save button, in red, if the MP3 couldn't be made. {error} is a technical reason, usually "MP3 encoding failed" (from src/lib/audio/mp3.ts:11 and :15)  <!-- src/app/session.svelte.ts:686 -->
  > Couldn't make the MP3 ({error}).

### Share sheet: top (rises from the bottom after SHARE)

- **When:** Heading of the share sheet  <!-- src/app/ShareSheet.svelte:113 -->
  > Your BeatVox

- **When:** Small button top right of the share sheet: closes it, back to the studio (button, ~8 chars)  <!-- src/app/ShareSheet.svelte:116 -->
  > STUDIO

- **When:** (screen reader) The three steps across the top  <!-- src/app/ShareSheet.svelte:120 -->
  > Steps

- **When:** Step 1 (always ticked)  <!-- src/app/ShareSheet.svelte:121 -->
  > MAKE IT

- **When:** Step 2. Also the button in the "Not on the map yet" box (button, ~8 chars)  <!-- src/app/ShareSheet.svelte:124, src/app/ShareSheet.svelte:176 -->
  > MAP IT

- **When:** Step 3  <!-- src/app/ShareSheet.svelte:127 -->
  > SHARE IT

### Share sheet, step 2: put it on the map

- **When:** (screen reader) The round play button for the saved loop, while it plays  <!-- src/app/ShareSheet.svelte:132 -->
  > Stop the loop

- **When:** (screen reader) The same button when stopped  <!-- src/app/ShareSheet.svelte:132 -->
  > Play the loop

- **When:** Label beside that play button  <!-- src/app/ShareSheet.svelte:140 -->
  > THE LOOP

- **When:** Small text under "THE LOOP"; {bars} is 8, {seconds} its length  <!-- src/app/ShareSheet.svelte:141 -->
  > {bars} bars · {seconds} s, repeating. This is what plays on the BeatVox map.

- **When:** Label on the name box  <!-- src/app/ShareSheet.svelte:146 -->
  > NAME IT

- **When:** Grey placeholder inside the empty name box  <!-- src/app/ShareSheet.svelte:147 -->
  > optional

- **When:** Heading over the map picker  <!-- src/app/ShareSheet.svelte:151 -->
  > PUT IT ON THE BEATVOX MAP

- **When:** Small text under that heading  <!-- src/app/ShareSheet.svelte:152 -->
  > Pick a place: where you are, or anywhere on the map.

- **When:** Button above the little map: uses the phone's location (button, ~11 chars)  <!-- src/app/PlacePicker.svelte:112 -->
  > WHERE I AM

- **When:** The same button while it finds you  <!-- src/app/PlacePicker.svelte:112 -->
  > FINDING…

- **When:** Small grey text beside WHERE I AM, before a place is picked (after, it shows the place's coordinates)  <!-- src/app/PlacePicker.svelte:113 -->
  > or search, or tap the map

- **When:** (screen reader) The place search box  <!-- src/lib/ui/PlaceSearch.svelte:81 -->
  > Find a place

- **When:** Grey placeholder inside the empty place search box  <!-- src/lib/ui/PlaceSearch.svelte:85 -->
  > search for a place

- **When:** (screen reader) The list of suggestions under the search box  <!-- src/lib/ui/PlaceSearch.svelte:101 -->
  > Places

- **When:** How each suggestion is written: the place in bold, then the bigger places it's in, e.g. "**Brooklyn** · New York, United States". The place names come from OpenStreetMap; only the " · " and ", " are ours  <!-- src/lib/geocode.ts:38 -->
  > **{name}** · {city, state, country}

- **When:** Small note under the search box when nothing matches  <!-- src/lib/ui/PlaceSearch.svelte:43 -->
  > No places by that name. Try another spelling, or tap the map.

- **When:** Small note under the search box when the search service can't be reached  <!-- src/lib/ui/PlaceSearch.svelte:46 -->
  > Couldn't search just now. Tap the map instead.

- **When:** Small note under the little map when the browser has no location feature  <!-- src/app/PlacePicker.svelte:89 -->
  > This browser can't tell where you are. Tap the map instead.

- **When:** Small note under the little map when the location couldn't be found (or permission was refused)  <!-- src/app/PlacePicker.svelte:103 -->
  > Couldn't get your location. Tap the map instead.

- **When:** Checkbox under the map (not shown for a reVox)  <!-- src/app/ShareSheet.svelte:157 -->
  > Others can reVox my voice (make their own beats with it)

- **When:** The terms checkbox's text while the terms load. Once loaded, the checkbox shows the terms sentence set in the Roundware project on the server (its "legal agreement"), which isn't in the code  <!-- src/app/ShareSheet.svelte:159 -->
  > Loading the terms…

- **When:** Link under the terms checkbox: opens the Terms in About  <!-- src/app/ShareSheet.svelte:160 -->
  > Read the terms

- **When:** Big pink button: sends it to the map; greyed out until a place is picked and the terms ticked (full-width button, ~30 chars)  <!-- src/app/ShareSheet.svelte:161 -->
  > SEND TO THE MAP

- **When:** Small line under that button before a place is picked  <!-- src/app/ShareSheet.svelte:163 -->
  > Choose a place first.

- **When:** Small line under that button once there's a place but the terms aren't ticked  <!-- src/app/ShareSheet.svelte:163 -->
  > Check the terms to send.

- **When:** Link at the bottom of step 2: go to sharing without the map  <!-- src/app/ShareSheet.svelte:165 -->
  > Skip the map, just save or share it →

### Sending to the map (pop-up)

- **When:** Heading of the pop-up while it sends  <!-- src/app/SendDialog.svelte:32 -->
  > SENDING YOUR BEATVOX

- **When:** Checklist item: the recording (skipped for a reVox)  <!-- src/app/SendDialog.svelte:9 -->
  > Your voice

- **When:** Checklist item: the 8-bar loop  <!-- src/app/SendDialog.svelte:9 -->
  > The loop

- **When:** Checklist item: how the voice was cut (skipped for a reVox)  <!-- src/app/SendDialog.svelte:9 -->
  > The slices

- **When:** Checklist item: the animated ring picture for link previews  <!-- src/app/SendDialog.svelte:9 -->
  > The picture

- **When:** Checklist item: the beat's pattern  <!-- src/app/SendDialog.svelte:9 -->
  > The beat

- **When:** Small note under the checklist  <!-- src/app/SendDialog.svelte:38 -->
  > Keep this page open.

- **When:** Heading of the pop-up if sending failed  <!-- src/app/SendDialog.svelte:40 -->
  > IT DIDN'T SEND

- **When:** The error in that pop-up when there's no other explanation  <!-- src/app/SendDialog.svelte:41 -->
  > Something went wrong.

- **When:** The error in that pop-up when the server can't be reached  <!-- src/lib/roundware.ts:364 -->
  > Couldn't reach Roundware. Check your connection and try again.

- **When:** The error in that pop-up when the server refused; {status} is a number like 500 and {detail} is the server's own message  <!-- src/lib/roundware.ts:379 -->
  > Roundware said {status}: {detail}

- **When:** The error in that pop-up when the server saved a file without its contents (rare)  <!-- src/lib/roundware.ts:346 -->
  > Roundware saved {fileName} without its file (asset {id}).

- **When:** Small note under the error  <!-- src/app/SendDialog.svelte:42 -->
  > Anything already sent won't be sent twice.

- **When:** Pink button in the failed pop-up. Also on a BeatVox's page when it can't load (button)  <!-- src/app/SendDialog.svelte:44, src/share/SharePage.svelte:115 -->
  > TRY AGAIN

- **When:** Button beside TRY AGAIN in the failed pop-up (button)  <!-- src/app/SendDialog.svelte:45 -->
  > CLOSE

### Share sheet, step 3: share it

- **When:** Line at the top once it's on the map; {id} is its number  <!-- src/app/ShareSheet.svelte:169 -->
  > On the map! BeatVox #{id}

- **When:** Box at the top when you skipped the map: its bold first line  <!-- src/app/ShareSheet.svelte:173 -->
  > Not on the map yet.

- **When:** The box's second line (its button says MAP IT, listed above)  <!-- src/app/ShareSheet.svelte:174 -->
  > Put it there and your posts link straight to your beat.

- **When:** The video box while the video is being made; {percent} counts up  <!-- src/app/VideoBox.svelte:44 -->
  > MAKING THE VIDEO… {percent}%

- **When:** The video box when this browser can't make videos; {shape} is "square" or "tall"  <!-- src/app/VideoBox.svelte:42 -->
  > This browser can't make the {shape} video. Try Chrome or Safari.

- **When:** (screen reader) The two-way choice of video shape under the video  <!-- src/app/ShareSheet.svelte:182 -->
  > Video shape

- **When:** Bold word on the first video shape choice (small button, ~6 chars)  <!-- src/app/ShareSheet.svelte:27 -->
  > SQUARE

- **When:** Small text under SQUARE  <!-- src/app/ShareSheet.svelte:27 -->
  > feeds and posts

- **When:** Bold word on the second video shape choice (small button, ~6 chars)  <!-- src/app/ShareSheet.svelte:27 -->
  > TALL

- **When:** Small text under TALL  <!-- src/app/ShareSheet.svelte:27 -->
  > Stories, Reels, TikTok

- **When:** Big pink button on a phone (opens the phone's share menu with the video) (full-width button, ~30 chars)  <!-- src/app/ShareSheet.svelte:191 -->
  > SHARE VIDEO…

- **When:** The same button on a computer, which saves the video instead  <!-- src/app/ShareSheet.svelte:191 -->
  > SAVE VIDEO

- **When:** Small line under that button, before sharing; the middle part is one of the next two items  <!-- src/app/ShareSheet.svelte:193 -->
  > We copy a caption with {your beat’s link|the BeatVox link} too, to paste in your post.

- **When:** Words in the line above once it's on the map  <!-- src/app/ShareSheet.svelte:193 -->
  > your beat’s link

- **When:** Words in the line above when it isn't on the map  <!-- src/app/ShareSheet.svelte:193 -->
  > the BeatVox link

- **When:** The same small line after sharing, if the caption went to the clipboard  <!-- src/app/ShareSheet.svelte:193 -->
  > Caption copied: paste it in your post.

- **When:** Button under that, only once it's on the map: share just the link (button)  <!-- src/app/ShareSheet.svelte:196 -->
  > SHARE THE LINK…

- **When:** Small note after SHARE THE LINK… copies it (on a computer). Also on a BeatVox's page after its share button copies the link  <!-- src/app/ShareSheet.svelte:93, src/share/SharePage.svelte:86 -->
  > Link copied.

- **When:** Small note when the link couldn't be shared or copied  <!-- src/app/ShareSheet.svelte:93 -->
  > Couldn't share the link.

- **When:** Small grey text in front of four little save links  <!-- src/app/ShareSheet.svelte:201 -->
  > Save to this device:

- **When:** Save link: the video in the shape picked  <!-- src/app/ShareSheet.svelte:203 -->
  > video

- **When:** Save link: the MP3 (your voice, then the beat)  <!-- src/app/ShareSheet.svelte:204 -->
  > MP3

- **When:** Save link: the animated ring picture  <!-- src/app/ShareSheet.svelte:205 -->
  > GIF

- **When:** Save link: just the 8-bar loop as an MP3  <!-- src/app/ShareSheet.svelte:206 -->
  > the loop

- **When:** Shown in red under the save links if the GIF couldn't be saved  <!-- src/app/session.svelte.ts:816 -->
  > Couldn't save the GIF. Try again.

- **When:** Shown in red under the save links if the phone's share menu failed; {error} is the browser's own reason  <!-- src/app/session.svelte.ts:927 -->
  > Couldn't share the video ({error}). Try saving it.

- **When:** Button at the bottom of the share sheet: closes it and starts a new beat with the same voice (button, ~14 chars; two share the row)  <!-- src/app/ShareSheet.svelte:212 -->
  > MAKE ANOTHER

- **When:** Button beside it: goes to the map, opened on your beat if you sent it (button, ~14 chars)  <!-- src/app/ShareSheet.svelte:213 -->
  > GLOBAL MAP

### What gets shared and saved (captions, titles, file names)

- **When:** The caption copied to the clipboard (and sent with the video) once it's on the map. {name} is the next item or the one after; {link} is its page's address  <!-- src/app/session.svelte.ts:884 -->
  > {name}: a voice turned into a beat. Hear it on the map and make your own: {link} #beatvox

- **When:** The same caption when it isn't on the map; {link} is the site's address  <!-- src/app/session.svelte.ts:885 -->
  > {name}: a voice turned into a beat. Make your own: {link} #beatvox

- **When:** {name} in the caption when you named it; {title} is the name, in curly quotes  <!-- src/app/session.svelte.ts:882 -->
  > My BeatVox, “{title}”

- **When:** {name} in the caption when you didn't name it. Also the title handed to the phone's share menu (with the video or the link) when you didn't name it  <!-- src/app/session.svelte.ts:882, src/app/session.svelte.ts:918, src/app/session.svelte.ts:950, src/app/session.svelte.ts:824 -->
  > My BeatVox

- **When:** The name of every saved file: {name} is your title in lower case with dashes (or "beat" if untitled), {date} like 20261113-1430, then the ending (.mp3, -loop.mp3, .gif, .mp4, -tall.mp4)  <!-- src/app/session.svelte.ts:760 -->
  > beatvox-{name}-{date}{ending}

- **When:** The {name} part of a saved file's name when you didn't name it. Also a word on a BeatVox's page, in the line under "THIS VOX AROUND THE WORLD" when there's one beat ("1 beat made from it so far"). If you want these two different, add a NOTE  <!-- src/app/session.svelte.ts:760, src/share/SharePage.svelte:214 -->
  > beat

### Style and beat names: the STYLE menu

The first style, "BeatVox", is listed with the site's name in section 1.

- **When:** An option in the STYLE menu on the beat card; also starts the line above the grid  <!-- src/styles/02-house.json:4 -->
  > House

- **When:** An option in the STYLE menu on the beat card; also starts the line above the grid  <!-- src/styles/03-boom-bap.json:4 -->
  > Boom Bap

- **When:** An option in the STYLE menu on the beat card; also starts the line above the grid  <!-- src/styles/04-rock.json:4 -->
  > Rock

- **When:** An option in the STYLE menu on the beat card; also starts the line above the grid  <!-- src/styles/05-breakbeat.json:4 -->
  > Breakbeat

- **When:** An option in the STYLE menu on the beat card; also starts the line above the grid  <!-- src/styles/06-dembow.json:4 -->
  > Dembow

- **When:** An option in the STYLE menu on the beat card; also starts the line above the grid  <!-- src/styles/07-trap.json:4 -->
  > Trap

- **When:** An option in the STYLE menu on the beat card; also starts the line above the grid  <!-- src/styles/08-drum-and-bass.json:4 -->
  > Drum & Bass

- **When:** An option in the STYLE menu on the beat card; also starts the line above the grid  <!-- src/styles/09-afrobeat.json:4 -->
  > Afrobeat

- **When:** An option in the STYLE menu on the beat card; also starts the line above the grid  <!-- src/styles/10-funk.json:4 -->
  > Funk

- **When:** An option in the STYLE menu on the beat card; also starts the line above the grid  <!-- src/styles/11-latin.json:4 -->
  > Latin

### Beat names inside each style

These show in bold in the line above the grid ("House: **Deep** · 2 of 10"). The same name used in several styles is listed once; changing it changes it in all of them.

- **When:** Beat name in the line above the grid, in BeatVox  <!-- src/styles/01-beatvox.json:11 -->
  > Original

- **When:** Beat name in the line above the grid, in BeatVox  <!-- src/styles/01-beatvox.json:20 -->
  > Lope

- **When:** Beat name in the line above the grid, in BeatVox  <!-- src/styles/01-beatvox.json:30 -->
  > Tumble

- **When:** Beat name in the line above the grid, in BeatVox  <!-- src/styles/01-beatvox.json:40 -->
  > Stutter

- **When:** Beat name in the line above the grid, in BeatVox  <!-- src/styles/01-beatvox.json:50 -->
  > Wobble

- **When:** Beat name in the line above the grid, in BeatVox  <!-- src/styles/01-beatvox.json:61 -->
  > Clatter

- **When:** Beat name in the line above the grid, in BeatVox  <!-- src/styles/01-beatvox.json:71 -->
  > Drift

- **When:** Beat name in the line above the grid, in BeatVox  <!-- src/styles/01-beatvox.json:83 -->
  > Knock

- **When:** Beat name in the line above the grid, in BeatVox  <!-- src/styles/01-beatvox.json:93 -->
  > Ghost

- **When:** Beat name in the line above the grid, in BeatVox  <!-- src/styles/01-beatvox.json:103 -->
  > Lurch

- **When:** Beat name in the line above the grid, in House, Boom Bap, Rock, Breakbeat, Dembow, Trap, Drum & Bass, Funk  <!-- src/styles/02-house.json:12, src/styles/03-boom-bap.json:12, src/styles/04-rock.json:11, src/styles/05-breakbeat.json:12, src/styles/06-dembow.json:11, src/styles/07-trap.json:11, src/styles/08-drum-and-bass.json:11, src/styles/10-funk.json:90 -->
  > Classic

- **When:** Beat name in the line above the grid, in House  <!-- src/styles/02-house.json:23 -->
  > Deep

- **When:** Beat name in the line above the grid, in House  <!-- src/styles/02-house.json:37 -->
  > Garage shuffle

- **When:** Beat name in the line above the grid, in House  <!-- src/styles/02-house.json:50 -->
  > Chicago jack

- **When:** Beat name in the line above the grid, in House  <!-- src/styles/02-house.json:62 -->
  > Tech

- **When:** Beat name in the line above the grid, in House  <!-- src/styles/02-house.json:76 -->
  > Disco

- **When:** Beat name in the line above the grid, in House  <!-- src/styles/02-house.json:89 -->
  > Afro

- **When:** Beat name in the line above the grid, in House, Drum & Bass  <!-- src/styles/02-house.json:103, src/styles/08-drum-and-bass.json:71 -->
  > Minimal

- **When:** Beat name in the line above the grid, in House  <!-- src/styles/02-house.json:117 -->
  > Acid

- **When:** Beat name in the line above the grid, in House  <!-- src/styles/02-house.json:130 -->
  > Broken

- **When:** Beat name in the line above the grid, in Boom Bap  <!-- src/styles/03-boom-bap.json:22 -->
  > Dusty

- **When:** Beat name in the line above the grid, in Boom Bap  <!-- src/styles/03-boom-bap.json:33 -->
  > Head nod

- **When:** Beat name in the line above the grid, in Boom Bap, Funk  <!-- src/styles/03-boom-bap.json:43, src/styles/10-funk.json:113 -->
  > Lazy

- **When:** Beat name in the line above the grid, in Boom Bap  <!-- src/styles/03-boom-bap.json:55 -->
  > Rimshot

- **When:** Beat name in the line above the grid, in Boom Bap  <!-- src/styles/03-boom-bap.json:65 -->
  > Double kick

- **When:** Beat name in the line above the grid, in Boom Bap, Funk  <!-- src/styles/03-boom-bap.json:74, src/styles/10-funk.json:36 -->
  > Ghost notes

- **When:** Beat name in the line above the grid, in Boom Bap  <!-- src/styles/03-boom-bap.json:84 -->
  > Open hat

- **When:** Beat name in the line above the grid, in Boom Bap  <!-- src/styles/03-boom-bap.json:95 -->
  > Golden era

- **When:** Beat name in the line above the grid, in Boom Bap  <!-- src/styles/03-boom-bap.json:106 -->
  > Slow roll

- **When:** Beat name in the line above the grid, in Rock  <!-- src/styles/04-rock.json:20 -->
  > Four on the floor

- **When:** Beat name in the line above the grid, in Rock  <!-- src/styles/04-rock.json:30 -->
  > Driving 16ths

- **When:** Beat name in the line above the grid, in Rock  <!-- src/styles/04-rock.json:39 -->
  > Half-time

- **When:** Beat name in the line above the grid, in Rock  <!-- src/styles/04-rock.json:50 -->
  > Punk

- **When:** Beat name in the line above the grid, in Rock  <!-- src/styles/04-rock.json:60 -->
  > Ride

- **When:** Beat name in the line above the grid, in Rock  <!-- src/styles/04-rock.json:70 -->
  > Stomp

- **When:** Beat name in the line above the grid, in Rock  <!-- src/styles/04-rock.json:80 -->
  > Tom groove

- **When:** Beat name in the line above the grid, in Rock  <!-- src/styles/04-rock.json:90 -->
  > Funk rock

- **When:** Beat name in the line above the grid, in Rock, Afrobeat  <!-- src/styles/04-rock.json:100, src/styles/09-afrobeat.json:89 -->
  > Shuffle

- **When:** Beat name in the line above the grid, in Breakbeat  <!-- src/styles/05-breakbeat.json:21 -->
  > Amen

- **When:** Beat name in the line above the grid, in Breakbeat  <!-- src/styles/05-breakbeat.json:30 -->
  > Funky drummer

- **When:** Beat name in the line above the grid, in Breakbeat  <!-- src/styles/05-breakbeat.json:40 -->
  > Think

- **When:** Beat name in the line above the grid, in Breakbeat  <!-- src/styles/05-breakbeat.json:49 -->
  > Big beat

- **When:** Beat name in the line above the grid, in Breakbeat  <!-- src/styles/05-breakbeat.json:60 -->
  > Nu skool

- **When:** Beat name in the line above the grid, in Breakbeat  <!-- src/styles/05-breakbeat.json:70 -->
  > Skippy

- **When:** Beat name in the line above the grid, in Breakbeat  <!-- src/styles/05-breakbeat.json:80 -->
  > Apache

- **When:** Beat name in the line above the grid, in Breakbeat  <!-- src/styles/05-breakbeat.json:90 -->
  > Chopped

- **When:** Beat name in the line above the grid, in Breakbeat, Funk  <!-- src/styles/05-breakbeat.json:100, src/styles/10-funk.json:134 -->
  > Rolling

- **When:** Beat name in the line above the grid, in Dembow  <!-- src/styles/06-dembow.json:20 -->
  > Perreo

- **When:** Beat name in the line above the grid, in Dembow  <!-- src/styles/06-dembow.json:30 -->
  > Dominican

- **When:** Beat name in the line above the grid, in Dembow  <!-- src/styles/06-dembow.json:40 -->
  > Moombahton

- **When:** Beat name in the line above the grid, in Dembow, Trap, Latin  <!-- src/styles/06-dembow.json:50, src/styles/07-trap.json:51, src/styles/11-latin.json:101 -->
  > Sparse

- **When:** Beat name in the line above the grid, in Dembow  <!-- src/styles/06-dembow.json:60 -->
  > Rolled snare

- **When:** Beat name in the line above the grid, in Dembow  <!-- src/styles/06-dembow.json:69 -->
  > Old school

- **When:** Beat name in the line above the grid, in Dembow  <!-- src/styles/06-dembow.json:79 -->
  > Dancehall

- **When:** Beat name in the line above the grid, in Dembow, Funk  <!-- src/styles/06-dembow.json:89, src/styles/10-funk.json:101 -->
  > Clap

- **When:** Beat name in the line above the grid, in Dembow  <!-- src/styles/06-dembow.json:98 -->
  > Trap-bow

- **When:** Beat name in the line above the grid, in Trap  <!-- src/styles/07-trap.json:21 -->
  > Rolls

- **When:** Beat name in the line above the grid, in Trap  <!-- src/styles/07-trap.json:31 -->
  > Triplet feel

- **When:** Beat name in the line above the grid, in Trap  <!-- src/styles/07-trap.json:41 -->
  > Drill

- **When:** Beat name in the line above the grid, in Trap, Afrobeat  <!-- src/styles/07-trap.json:63, src/styles/09-afrobeat.json:24 -->
  > Busy hats

- **When:** Beat name in the line above the grid, in Trap  <!-- src/styles/07-trap.json:72 -->
  > Clap stack

- **When:** Beat name in the line above the grid, in Trap  <!-- src/styles/07-trap.json:82 -->
  > Bounce

- **When:** Beat name in the line above the grid, in Trap  <!-- src/styles/07-trap.json:92 -->
  > Dark

- **When:** Beat name in the line above the grid, in Trap  <!-- src/styles/07-trap.json:104 -->
  > Rattle

- **When:** Beat name in the line above the grid, in Drum & Bass  <!-- src/styles/08-drum-and-bass.json:20 -->
  > Amen roller

- **When:** Beat name in the line above the grid, in Drum & Bass  <!-- src/styles/08-drum-and-bass.json:28 -->
  > Liquid

- **When:** Beat name in the line above the grid, in Drum & Bass  <!-- src/styles/08-drum-and-bass.json:40 -->
  > Jump up

- **When:** Beat name in the line above the grid, in Drum & Bass  <!-- src/styles/08-drum-and-bass.json:50 -->
  > Halftime

- **When:** Beat name in the line above the grid, in Drum & Bass  <!-- src/styles/08-drum-and-bass.json:60 -->
  > Jungle

- **When:** Beat name in the line above the grid, in Drum & Bass  <!-- src/styles/08-drum-and-bass.json:82 -->
  > Ghosted

- **When:** Beat name in the line above the grid, in Drum & Bass  <!-- src/styles/08-drum-and-bass.json:91 -->
  > Steppa

- **When:** Beat name in the line above the grid, in Drum & Bass  <!-- src/styles/08-drum-and-bass.json:101 -->
  > Neuro

- **When:** Beat name in the line above the grid, in Afrobeat  <!-- src/styles/09-afrobeat.json:13 -->
  > Steady

- **When:** Beat name in the line above the grid, in Afrobeat  <!-- src/styles/09-afrobeat.json:35 -->
  > Off the one

- **When:** Beat name in the line above the grid, in Afrobeat  <!-- src/styles/09-afrobeat.json:46 -->
  > Driving

- **When:** Beat name in the line above the grid, in Afrobeat  <!-- src/styles/09-afrobeat.json:58 -->
  > Hand drums

- **When:** Beat name in the line above the grid, in Afrobeat  <!-- src/styles/09-afrobeat.json:67 -->
  > Bell and drums

- **When:** Beat name in the line above the grid, in Afrobeat  <!-- src/styles/09-afrobeat.json:78 -->
  > Heavy

- **When:** Beat name in the line above the grid, in Funk  <!-- src/styles/10-funk.json:13 -->
  > Ghost kick

- **When:** Beat name in the line above the grid, in Funk  <!-- src/styles/10-funk.json:25 -->
  > Tight

- **When:** Beat name in the line above the grid, in Funk  <!-- src/styles/10-funk.json:47 -->
  > Sixteenths

- **When:** Beat name in the line above the grid, in Funk  <!-- src/styles/10-funk.json:58 -->
  > Fast

- **When:** Beat name in the line above the grid, in Funk  <!-- src/styles/10-funk.json:68 -->
  > Pocket

- **When:** Beat name in the line above the grid, in Funk  <!-- src/styles/10-funk.json:79 -->
  > Slow drag

- **When:** Beat name in the line above the grid, in Funk  <!-- src/styles/10-funk.json:124 -->
  > Up-tempo

- **When:** Beat name in the line above the grid, in Latin  <!-- src/styles/11-latin.json:13 -->
  > Samba

- **When:** Beat name in the line above the grid, in Latin  <!-- src/styles/11-latin.json:25 -->
  > Uptown

- **When:** Beat name in the line above the grid, in Latin (in the file it's written Bai\u00e3o)  <!-- src/styles/11-latin.json:35 -->
  > Baião

- **When:** Beat name in the line above the grid, in Latin  <!-- src/styles/11-latin.json:46 -->
  > Backbeat

- **When:** Beat name in the line above the grid, in Latin  <!-- src/styles/11-latin.json:57 -->
  > Samba, light

- **When:** Beat name in the line above the grid, in Latin (in the file it's written Bai\u00e3o)  <!-- src/styles/11-latin.json:68 -->
  > Baião, rolling

- **When:** Beat name in the line above the grid, in Latin  <!-- src/styles/11-latin.json:78 -->
  > Samba, fast

- **When:** Beat name in the line above the grid, in Latin  <!-- src/styles/11-latin.json:89 -->
  > Street

- **When:** Beat name in the line above the grid, in Latin  <!-- src/styles/11-latin.json:113 -->
  > Bomba

- **When:** Beat name in the line above the grid, in Latin  <!-- src/styles/11-latin.json:123 -->
  > Samba, full

- **When:** Beat name in the line above the grid, in Latin  <!-- src/styles/11-latin.json:134 -->
  > Bells

- **When:** Beat name in the line above the grid, in Latin  <!-- src/styles/11-latin.json:145 -->
  > Slow burn

- **When:** Beat name in the line above the grid, in Latin  <!-- src/styles/11-latin.json:157 -->
  > Bossa

---

## 4. Drawn into the videos, the GIF and the preview picture

This text is painted into the pictures, so it isn't read out or translated. Space is tight: the square video is 540 px wide and the tall one 405 px.

### The videos (square and tall)

Also painted on the videos, but listed earlier: the BEATVOX wordmark (map page header), the web address "beatvox.app" (section 1) and "MAKE YOUR OWN" on the end card (map beat sheet).

- **When:** The name under the wordmark when you didn't name it, on the videos and the animated GIF / link preview picture (and in the video still while it's being made). This is what actually shows for an untitled beat  <!-- src/lib/audio/engine.ts:987 -->
  > Captured beat

- **When:** Small grey text bottom right of the square video, above the web address  <!-- src/lib/video/draw.ts:322 -->
  > make your own

- **When:** Small grey text in front of the web address, under the name, at the top of the tall video  <!-- src/lib/video/draw.ts:334 -->
  > make your own ·

- **When:** Small label near the bottom while the video plays your voice (a waveform under it)  <!-- src/lib/video/draw.ts:352 -->
  > THE VOICE

- **When:** The same label once the beat starts; {bars} is 8 (a row of little boxes under it fills in)  <!-- src/lib/video/draw.ts:369 -->
  > THE BEAT · {bars} BARS

- **When:** Small grey line under the name on the video's end card. Also bottom right of the animated GIF / link preview picture  <!-- src/lib/video/draw.ts:397, src/lib/card.ts:113 -->
  > a voice turned into a beat

### The animated GIF / a BeatVox's link preview picture

The ring on the left, the words on the right: BEATVOX, the name, and "a beat made from one voice" (all listed above).

- **When:** The name on the GIF if there's none at all (it shouldn't happen: an untitled beat shows "Captured beat")  <!-- src/lib/card.ts:110 -->
  > Untitled

---

## 5. A BeatVox's own page (beatvox.app/b/…)

The page a shared link opens. Its LIKE/FLAG, "made with the vox from", THE SOURCE VOX, play buttons, MAP, MAKE YOUR OWN, REVOX THIS VOX, TRY AGAIN and "Link copied." are listed above.

### Header and loading

- **When:** The browser tab's title on a BeatVox's page; {title} is the beat's name  <!-- src/share/SharePage.svelte:35 -->
  > {title} · BeatVox

- **When:** While the beat loads  <!-- src/share/SharePage.svelte:118 -->
  > Loading the beat…

### When something's wrong

- **When:** Label on the box shown if the page couldn't load  <!-- src/share/SharePage.svelte:113 -->
  > SOMETHING WENT WRONG

- **When:** The text in that box  <!-- src/share/SharePage.svelte:40 -->
  > Couldn't reach the BeatVox server. Check your connection and try again.

- **When:** Label on the box shown when the beat isn't on the map yet (still processing)  <!-- src/share/SharePage.svelte:121 -->
  > WAITING FOR PROCESSING

- **When:** Heading in that box  <!-- src/share/SharePage.svelte:122 -->
  > This BeatVox isn't on the map yet.

- **When:** Text in that box  <!-- src/share/SharePage.svelte:123 -->
  > Sometimes it takes a little while; other times there is a glitch! Please try again soon.

- **When:** Label on the box shown when there's no such beat  <!-- src/share/SharePage.svelte:128 -->
  > NOT FOUND

- **When:** Heading in that box  <!-- src/share/SharePage.svelte:129 -->
  > There's no BeatVox here.

- **When:** Text in that box  <!-- src/share/SharePage.svelte:130 -->
  > It may have been taken down, or the link is incomplete.

### The beat

- **When:** (screen reader) The share button top right, beside the beat's name  <!-- src/share/SharePage.svelte:140 -->
  > Share this BeatVox

- **When:** The text sent with the link by the phone's share menu; {title} is the beat's name  <!-- src/share/SharePage.svelte:77 -->
  > {title}: a voice turned into a beat with BeatVox

- **When:** (screen reader) The big ring  <!-- src/share/SharePage.svelte:149 -->
  > The beat as a circle: 8 rings of 16 steps, colored by sound

- **When:** (screen reader) The big play button in the middle of the ring, while it plays (stopped, it's "Play the beat", listed above)  <!-- src/share/SharePage.svelte:152 -->
  > Pause the beat

- **When:** Small note under the ring for an old beat saved without its pattern  <!-- src/share/SharePage.svelte:169 -->
  > This beat was saved without its pattern, so the ring is empty. It will still play.

- **When:** Small line under "THE SOURCE VOX" on a BeatVox's page  <!-- src/share/SharePage.svelte:183 -->
  > the recording this beat is made from

- **When:** Small note if the sound can't be loaded when you press play  <!-- src/share/player.svelte.ts:80 -->
  > Couldn't load the sound. Check your connection and try again.

### The small map of this voice's beats

- **When:** (screen reader) The small map; {n} is how many beats  <!-- src/share/SharePage.svelte:187 -->
  > This vox around the world: {n} beats. Open the map.

- **When:** Strip under the small map; BEAT/BEATS (listed with the map's wander bar) and PLACE/PLACES change with the numbers  <!-- src/share/SharePage.svelte:190 -->
  > THIS VOX · {n} {BEAT|BEATS} · {places} {PLACE|PLACES}

- **When:** Word in the strip when they're all in one place  <!-- src/share/SharePage.svelte:190 -->
  > PLACE

- **When:** Word in the strip for more places  <!-- src/share/SharePage.svelte:190 -->
  > PLACES

- **When:** Bold word at the right end of the strip  <!-- src/share/SharePage.svelte:191 -->
  > open

### Bottom bar

- **When:** Text beside REVOX THIS VOX, when the voice can be reVoxed. The link opens the studio  <!-- src/share/SharePage.svelte:203 -->
  > Make your own beat with this source, or [record your own](/studio).

- **When:** Text beside MAKE YOUR OWN, when the voice can't be reVoxed  <!-- src/share/SharePage.svelte:206 -->
  > Record your voice and BeatVox makes a beat from it.

### The bigger map (tap the small map)

- **When:** (screen reader) The bigger map pop-up  <!-- src/share/SharePage.svelte:210 -->
  > This vox around the world

- **When:** Heading of the bigger map pop-up  <!-- src/share/SharePage.svelte:213 -->
  > THIS VOX AROUND THE WORLD

- **When:** Line under that heading; beat/beats changes with the number  <!-- src/share/SharePage.svelte:214 -->
  > {n} {beat|beats} made from it so far

The word "beat" for one beat is listed with the saved file names in section 3.

- **When:** Word in the line above for any other number  <!-- src/share/SharePage.svelte:214 -->
  > beats

- **When:** (screen reader) The X top right of the bigger map pop-up  <!-- src/share/SharePage.svelte:216 -->
  > Close the map

- **When:** Small tag beside this beat in the list of the voice's beats  <!-- src/share/SharePage.svelte:249 -->
  > THIS ONE

- **When:** Button at the bottom of the pop-up: the big map, opened on this beat (button, ~14 chars; two share the row)  <!-- src/share/SharePage.svelte:254 -->
  > THE WHOLE MAP

- **When:** Pink button beside it: opens the studio (with this voice if it can be reVoxed) (button, ~14 chars)  <!-- src/share/SharePage.svelte:255 -->
  > ADD YOURS

---

## 6. About (the "?" button, or beatvox.app/about)

On a phone it rises from the bottom; on a computer it's a panel on the right.

### Top of About

- **When:** The browser tab's title while About is open  <!-- src/about/About.svelte:22 -->
  > About · BeatVox

- **When:** Label at the very top of About  <!-- src/about/About.svelte:60 -->
  > ABOUT BEATVOX

- **When:** (screen reader) The X top right of About  <!-- src/about/About.svelte:61 -->
  > Close About

- **When:** Label in the "now playing" line at the top of About, when it's opened from the map while wandering; the beat's name follows it  <!-- src/about/About.svelte:67 -->
  > WANDERING

- **When:** Small button in that line: go on to the next beat (its other button says STOP, listed above) (button, ~6 chars)  <!-- src/about/About.svelte:68 -->
  > SKIP

The heading "Putting rhythm / into your voice." is listed with the welcome card.

- **When:** The paragraph under the heading  <!-- src/about/AboutContent.svelte:23 -->
  > BeatVox turns a few seconds of your voice into a beat. Record anything, and it cuts the sound into slices and plays them as an eight-row drum machine that keeps changing. Put your beat on the map with everyone else’s, and let others make new beats from your voice.

### How it works

- **When:** Box heading  <!-- src/about/AboutContent.svelte:29 -->
  > HOW IT WORKS

- **When:** Step 1, bold word  <!-- src/about/AboutContent.svelte:11 -->
  > Record

- **When:** Step 1, text  <!-- src/about/AboutContent.svelte:11 -->
  > Record anything for up to 15 seconds: your name, a word, a beatbox.

- **When:** Step 2, bold word  <!-- src/about/AboutContent.svelte:12 -->
  > Slice

- **When:** Step 2, text  <!-- src/about/AboutContent.svelte:12 -->
  > BeatVox cuts it into short slices, like the pads of a drum machine.

Step 3's bold word, "Beat", is listed with the studio's beat card (it's also the beat card's screen-reader name).

- **When:** Step 3, text  <!-- src/about/AboutContent.svelte:13 -->
  > Eight rows of slices play a beat that keeps changing. Tap the grid to customize.

- **When:** Step 4, bold words  <!-- src/about/AboutContent.svelte:14 -->
  > Map it

- **When:** Step 4, text  <!-- src/about/AboutContent.svelte:14 -->
  > Choose a name, pick a place, and add it to the map with everyone else’s.

- **When:** Step 5, bold words  <!-- src/about/AboutContent.svelte:15 -->
  > Share it

- **When:** Step 5, text  <!-- src/about/AboutContent.svelte:15 -->
  > Post the video, send the link, or save the MP3 and GIF.

### Since 2008

- **When:** Box heading  <!-- src/about/AboutContent.svelte:38 -->
  > BORN IN 2008

- **When:** (screen reader) Description of the photo of the 2008 booth  <!-- src/about/AboutContent.svelte:40 -->
  > Halsey Burgund beside the BeatVox booth, its plywood walls covered in visitors’ writing, at the Newport Folk Festival in 2008

- **When:** Caption under the photo  <!-- src/about/AboutContent.svelte:41 -->
  > The BeatVox booth, Newport Folk Festival, 2008

- **When:** Paragraph under the photo  <!-- src/about/AboutContent.svelte:44 -->
  > The first BeatVox experiment was in 2008 as an installation built in Max/MSP, shown at the [Newport Folk Festival](https://newportfolk.org/). Visitors stepped up to a microphone and heard their voices turned into beats. Then it took an 18 year break! This is version 2, rebuilt in 2026 for phones and the web, with a map so the beats can be a part of a global community.

### Made by

- **When:** Box heading  <!-- src/about/AboutContent.svelte:52 -->
  > MADE BY

- **When:** Your name, big, at the top of the box  <!-- src/about/AboutContent.svelte:53 -->
  > Halsey Burgund

- **When:** Your bio under your name  <!-- src/about/AboutContent.svelte:55 -->
  > Halsey Burgund is an artist and [Emmy-winning interactive director](https://moondisaster.halseyburgund.com) whose work focuses on the combination of modern technologies - from mobile phones to artificial intelligence - with fundamentally human “technologies”, primarily language, music and the spoken voice. He is the creator of [Roundware](https://roundware.org), the open source contributory audio AR platform, which has been used to create art and educational installations for cultural organizations internationally. More at [halseyburgund.com](https://halseyburgund.com)!

### What you make is yours (folding section)

- **When:** Title of the folding section (tap to open)  <!-- src/about/AboutContent.svelte:65 -->
  > What you make is yours

- **When:** Bold line 1  <!-- src/about/AboutContent.svelte:67 -->
  > You own what you make.

- **When:** Text under bold line 1  <!-- src/about/AboutContent.svelte:68 -->
  > Your voice, your BeatVoxes, and the videos, MP3s and GIFs are yours to use however you like.

- **When:** Bold line 2  <!-- src/about/AboutContent.svelte:69 -->
  > BeatVox may use them too.

- **When:** Text under bold line 2  <!-- src/about/AboutContent.svelte:70 -->
  > Anything you send to the map can be shared, highlighted and hosted by the project: on the map, on its own page and in Roundware.

- **When:** Bold line 3  <!-- src/about/AboutContent.svelte:71 -->
  > Credit is appreciated, not required.

- **When:** Text under bold line 3  <!-- src/about/AboutContent.svelte:72 -->
  > If you post one or use it in another creation, “made with BeatVox” and a link is lovely and appreciated, but not required!

- **When:** Bold line 4  <!-- src/about/AboutContent.svelte:73 -->
  > Only use what you have the right to use.

- **When:** Text under bold line 4  <!-- src/about/AboutContent.svelte:74 -->
  > Record your own voice, or someone else’s with their permission. No recordings of other people’s songs, speeches or shows unless you are sure they are in the public domain or you otherwise have the right to do so.

- **When:** Bold line 5  <!-- src/about/AboutContent.svelte:75 -->
  > reVoxes are opt-in.

- **When:** Text under bold line 5 (it quotes the checkbox in the share sheet, so keep the two in step)  <!-- src/about/AboutContent.svelte:76 -->
  > Others can make beats from your voice only if you check “Others can reVox my voice” when you send it.

### Questions (folding section)

- **When:** Title of the folding section  <!-- src/about/AboutContent.svelte:81 -->
  > Questions

- **When:** Question 1  <!-- src/about/AboutContent.svelte:83 -->
  > Can I use my BeatVox commercially?

- **When:** Answer 1  <!-- src/about/AboutContent.svelte:84 -->
  > Yes. It’s yours: put it in a track, a video, an ad, anything. Just don't do that with other people's!

- **When:** Question 2  <!-- src/about/AboutContent.svelte:85 -->
  > What’s a reVox?

- **When:** Answer 2  <!-- src/about/AboutContent.svelte:86 -->
  > A new beat made from someone else’s voice. It links back to the original source so you can hear everything made from the same starting audio.

- **When:** Question 3  <!-- src/about/AboutContent.svelte:87 -->
  > How do I remove mine from the map?

- **When:** Answer 3  <!-- src/about/AboutContent.svelte:88 -->
  > Email [hello@beatvox.app](mailto:hello@beatvox.app) with the link to its page and it will be removed.

- **When:** Question 4  <!-- src/about/AboutContent.svelte:89 -->
  > How exact is my place on the map?

- **When:** Answer 4 (it names the WHERE I AM button, so keep the two in step)  <!-- src/about/AboutContent.svelte:90 -->
  > Exactly where you put the pin. WHERE I AM uses your phone’s location, so at home you may prefer to search for your town and pick a spot rather than sharing a specific private location.

- **When:** Question 5  <!-- src/about/AboutContent.svelte:91 -->
  > Is anything uploaded before I send it?

- **When:** Answer 5 (it names the SEND TO THE MAP button, so keep the two in step)  <!-- src/about/AboutContent.svelte:92 -->
  > No. Your recording stays on your device until you press SEND TO THE MAP, and is gone when you leave the page if you don’t. You can download your mix and video without sharing to the map (though we really hope you will share!).

- **When:** Question 5b (added Nov 2026)  <!-- src/about/AboutContent.svelte -->
  > What happens when I add my BeatVox to the map?

- **When:** Answer 5b  <!-- src/about/AboutContent.svelte -->
  > Everything is shared publicly on the map automatically and immediately when you add it, but I reserve the right to remove or otherwise curate the content in BeatVox at my own discretion.

- **When:** Question 6  <!-- src/about/AboutContent.svelte:93 -->
  > Why does the sound stop when my screen goes dark?

- **When:** Answer 6  <!-- src/about/AboutContent.svelte:94 -->
  > Phones pause sound in the browser when they lock. Keep the screen on while you play.

- **When:** Question 7  <!-- src/about/AboutContent.svelte:95 -->
  > What do I need?

- **When:** Answer 7  <!-- src/about/AboutContent.svelte:96 -->
  > A recent phone or laptop browser with a microphone. There are no accounts, nor do you need to download an app.

### Your recordings and privacy (folding section)

- **When:** Title of the folding section  <!-- src/about/AboutContent.svelte:101 -->
  > Your recordings and privacy

- **When:** Bold line 1  <!-- src/about/AboutContent.svelte:103 -->
  > When you send a BeatVox, it keeps:

- **When:** Text under bold line 1  <!-- src/about/AboutContent.svelte:104 -->
  > your recording, your beat (the loop, its picture and its recipe), its name, the place you picked, and whether others may reVox it.

- **When:** Bold line 2  <!-- src/about/AboutContent.svelte:105 -->
  > It doesn’t ask for:

- **When:** Text under bold line 2  <!-- src/about/AboutContent.svelte:106 -->
  > your name, email or an account.

- **When:** Bold line 3  <!-- src/about/AboutContent.svelte:107 -->
  > Where it’s kept:

- **When:** Text under bold line 3  <!-- src/about/AboutContent.svelte:109 -->
  > on Roundware, the platform BeatVox runs on, on DigitalOcean servers in the US. [Roundware’s privacy policy](https://roundware.app/legal/privacy/) explains how it’s kept and how to have it removed.

- **When:** Bold line 4  <!-- src/about/AboutContent.svelte:113 -->
  > Visits are counted anonymously.

- **When:** Text under bold line 4  <!-- src/about/AboutContent.svelte:115 -->
  > BeatVox counts page views and moments like sending to the map with GoatCounter, from its own server: no cookies, no tracking scripts, nothing that identifies you. Roundware also notes what gets played, so the project knows which BeatVoxes are heard. Your browser keeps a random ID for this and remembers your likes; neither is tied to your name.

### Terms (folding section)

The share sheet's "Read the terms" link opens this one.

- **When:** Title of the folding section  <!-- src/about/AboutContent.svelte:123 -->
  > Terms

- **When:** Term 1  <!-- src/about/AboutContent.svelte:125 -->
  > BeatVox is an art project, offered as is, with no warranty.

- **When:** Term 2  <!-- src/about/AboutContent.svelte:126 -->
  > It may change, pause or close. Beats on the map may not be kept forever.

- **When:** Term 3  <!-- src/about/AboutContent.svelte:127 -->
  > The project may remove anything, for any reason, including on request.

- **When:** Term 4  <!-- src/about/AboutContent.svelte:129 -->
  > Sending a BeatVox means you agree to these terms. Roundware stores it for the project under [Roundware’s privacy policy](https://roundware.app/legal/privacy/).

### Credits (folding section)

- **When:** Title of the folding section  <!-- src/about/AboutContent.svelte:136 -->
  > Credits

- **When:** Credit 1  <!-- src/about/AboutContent.svelte:138 -->
  > [Roundware](https://roundware.org): the open-source platform that stores and plays the map

- **When:** Credit 2  <!-- src/about/AboutContent.svelte:139 -->
  > [OpenStreetMap contributors](https://www.openstreetmap.org/copyright): the map data

- **When:** Credit 3  <!-- src/about/AboutContent.svelte:140 -->
  > [OpenFreeMap](https://openfreemap.org): the map tiles

- **When:** Credit 4  <!-- src/about/AboutContent.svelte:141 -->
  > [MapLibre](https://maplibre.org): drawing the map

- **When:** Credit 5  <!-- src/about/AboutContent.svelte:142 -->
  > [Photon by Komoot](https://photon.komoot.io): place search

- **When:** Credit 6  <!-- src/about/AboutContent.svelte:143 -->
  > [Mediabunny](https://mediabunny.dev): making the videos

- **When:** Credit 7 (the CC BY 4.0 licence asks for this credit, so keep the dataset name, Google Magenta and the licence link)  <!-- src/about/AboutContent.svelte:145 -->
  > [Groove MIDI Dataset](https://magenta.tensorflow.org/datasets/groove) by Google Magenta ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)): the Afrobeat, Funk and Latin beats, from real drummers' playing

- **When:** Credit 8  <!-- src/about/AboutContent.svelte:151 -->
  > Courier Prime: the type

### Footer

- **When:** Line at the bottom of About  <!-- src/about/AboutContent.svelte:157 -->
  > Questions, or want a BeatVox taken down? [hello@beatvox.app](mailto:hello@beatvox.app)

- **When:** Small line at the very bottom of About  <!-- src/about/AboutContent.svelte:158 -->
  > © 2026 Halsey Burgund · BeatVox v2

---

## 7. Anything else

- **When:** The map credit in the corner of every map (the big map, the place picker and the small maps on a BeatVox's page; on the small ones it's folded into an (i) button). The map's terms require crediting OpenMapTiles and OpenStreetMap, so reword with care  <!-- src/map/risoStyle.ts:43 -->
  > [OpenFreeMap](https://openfreemap.org) [© OpenMapTiles](https://www.openmaptiles.org/) Data from [OpenStreetMap](https://www.openstreetmap.org/copyright)
