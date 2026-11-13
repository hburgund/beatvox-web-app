<!--
  The About copy: what BeatVox is, how it works, its history, who made it,
  then folding sections. Plain markup, so the words are easy to rewrite.
  Each section's id (about-<name>) is what /about#<name> and the in-app
  links open; keep them in step with SECTIONS in aboutState.svelte.ts.
-->
<script lang="ts">
  import booth from './beatvox-2008-newport.jpg';

  const steps = [
    ['Record', 'Record anything for up to 15 seconds: your name, a word, a beatbox.'],
    ['Slice', 'BeatVox cuts it into short slices, like the pads of a drum machine.'],
    ['Beat', 'Eight rows of slices play a beat that keeps changing. Tap the grid to customize.'],
    ['Map it', 'Choose a name, pick a place, and add it to the map with everyone else’s.'],
    ['Share it', 'Post the video, send the link, or save the MP3 and GIF.'],
  ];
</script>

<div class="about">
  <section class="intro">
    <h2 id="about-title">Putting rhythm<br />into your voice.</h2>
    <p>
      BeatVox turns a few seconds of your voice into a beat. Record anything, and it cuts the sound into slices and plays them as an eight-row drum
      machine that keeps changing. Put your beat on the map with everyone else’s, and let others make new beats from your voice.
    </p>
  </section>

  <section id="about-how" class="card box">
    <h3 class="label">HOW IT WORKS</h3>
    <ol class="steps">
      {#each steps as [t, d], i (t)}
        <li><span class="num" aria-hidden="true">{i + 1}</span><span><b>{t}</b><span class="d">{d}</span></span></li>
      {/each}
    </ol>
  </section>

  <section id="about-since" class="card box">
    <h3 class="label">BORN IN 2008</h3>
    <figure>
      <img src={booth} width="360" height="240" alt="Halsey Burgund beside the BeatVox booth, its plywood walls covered in visitors’ writing, at the Newport Folk Festival in 2008" />
      <figcaption>The BeatVox booth, Newport Folk Festival, 2008</figcaption>
    </figure>
    <p>
      The first BeatVox experiment was in 2008 as an installation built in Max/MSP, shown at the
      <a href="https://newportfolk.org/" target="_blank" rel="noopener">Newport Folk Festival</a>. Visitors stepped up to a
      microphone and heard their voices turned into beats. Then it took an 18 year break! This is version 2, rebuilt in 2026 for phones and the web,
      with a map so the beats can be a part of a global community.
    </p>
  </section>

  <section class="card box maker">
    <h3 class="label">MADE BY</h3>
    <p class="name">Halsey Burgund</p>
    <p>
      Halsey Burgund is an artist and
      <a href="https://moondisaster.halseyburgund.com" target="_blank" rel="noopener">Emmy-winning interactive director</a> whose work focuses on the combination of modern technologies - from mobile phones
      to artificial intelligence - with fundamentally human “technologies”, primarily language, music and the spoken voice. He is the creator of
      <a href="https://roundware.org" target="_blank" rel="noopener">Roundware</a>, the open source contributory audio AR platform, which has been used
      to create art and educational installations for cultural organizations internationally. More at
      <a href="https://halseyburgund.com" target="_blank" rel="noopener">halseyburgund.com</a>!
    </p>
  </section>

  <div class="folds">
    <details id="about-own">
      <summary>What you make is yours <span class="pm" aria-hidden="true"></span></summary>
      <dl>
        <dt>You own what you make.</dt>
        <dd>Your voice, your BeatVoxes, and the videos, MP3s and GIFs are yours to use however you like.</dd>
        <dt>BeatVox may use them too.</dt>
        <dd>Anything you send to the map can be shared, highlighted and hosted by the project: on the map, on its own page and in Roundware.</dd>
        <dt>Credit is appreciated, not required.</dt>
        <dd>If you post one or use it in another creation, “made with BeatVox” and a link is lovely and appreciated, but not required!</dd>
        <dt>Only use what you have the right to use.</dt>
        <dd>Record your own voice, or someone else’s with their permission. No recordings of other people’s songs, speeches or shows unless you are sure they are in the public domain or you otherwise have the right to do so.</dd>
        <dt>reVoxes are opt-in.</dt>
        <dd>Others can make beats from your voice only if you check “Others can reVox my voice” when you send it.</dd>
      </dl>
    </details>

    <details id="about-faq">
      <summary>Questions <span class="pm" aria-hidden="true"></span></summary>
      <dl>
        <dt>Can I use my BeatVox commercially?</dt>
        <dd>Yes. It’s yours: put it in a track, a video, an ad, anything. Just don’t do that with other people’s!</dd>
        <dt>What’s a reVox?</dt>
        <dd>A new beat made from someone else’s voice. It links back to the original source so you can hear everything made from the same starting audio.</dd>
        <dt>How do I remove mine from the map?</dt>
        <dd>Email <a class="mail" href="mailto:hello@beatvox.app">hello@beatvox.app</a> with the link to its page and it will be removed.</dd>
        <dt>How exact is my place on the map?</dt>
        <dd>Exactly where you put the pin. WHERE I AM uses your phone’s location, so at home you may prefer to search for your town and pick a spot rather than sharing a specific private location.</dd>
        <dt>Is anything uploaded before I send it?</dt>
        <dd>No. Your recording stays on your device until you press SEND TO THE MAP, and is gone when you leave the page if you don’t. You can download your mix and video without sharing to the map (though we really hope you will share!).</dd>
        <dt>What happens when I add my BeatVox to the map?</dt>
        <dd>
          Everything is shared publicly on the map automatically and immediately when you add it, but I reserve the right to remove or otherwise curate
          the content in BeatVox at my own discretion.
        </dd>
        <dt>Why does the sound stop when my screen goes dark?</dt>
        <dd>Phones pause sound in the browser when they lock. Keep the screen on while you play.</dd>
        <dt>What do I need?</dt>
        <dd>A recent phone or laptop browser with a microphone. There are no accounts, nor do you need to download an app.</dd>
      </dl>
    </details>

    <details id="about-privacy">
      <summary>Your recordings and privacy <span class="pm" aria-hidden="true"></span></summary>
      <dl>
        <dt>When you send a BeatVox, it keeps:</dt>
        <dd>your recording, your beat (the loop, its picture and its recipe), its name, the place you picked, and whether others may reVox it.</dd>
        <dt>It doesn’t ask for:</dt>
        <dd>your name, email or an account.</dd>
        <dt>Where it’s kept:</dt>
        <dd>
          on Roundware, the platform BeatVox runs on, on DigitalOcean servers in the US.
          <a href="https://roundware.app/legal/privacy/" target="_blank" rel="noopener">Roundware’s privacy policy</a> explains how it’s kept and how to have
          it removed.
        </dd>
        <dt>Visits are counted anonymously.</dt>
        <dd>
          BeatVox counts page views and moments like sending to the map with GoatCounter, from its own server: no cookies, no tracking scripts, nothing that
          identifies you. Roundware also notes what gets played, so the project knows which BeatVoxes are heard. Your browser keeps a random ID for this and
          remembers your likes; neither is tied to your name.
        </dd>
      </dl>
    </details>

    <details id="about-terms">
      <summary>Terms <span class="pm" aria-hidden="true"></span></summary>
      <ul>
        <li>BeatVox is an art project, offered as is, with no warranty.</li>
        <li>It may change, pause or close. Beats on the map may not be kept forever.</li>
        <li>The project may remove anything, for any reason, including on request.</li>
        <li>
          Sending a BeatVox means you agree to these terms. Roundware stores it for the project under
          <a href="https://roundware.app/legal/privacy/" target="_blank" rel="noopener">Roundware’s privacy policy</a>.
        </li>
      </ul>
    </details>

    <details id="about-credits">
      <summary>Credits <span class="pm" aria-hidden="true"></span></summary>
      <ul class="credits">
        <li><a href="https://roundware.org" target="_blank" rel="noopener">Roundware</a>: the open-source platform that stores and plays the map</li>
        <li><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>: the map data</li>
        <li><a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>: the map tiles</li>
        <li><a href="https://maplibre.org" target="_blank" rel="noopener">MapLibre</a>: drawing the map</li>
        <li><a href="https://photon.komoot.io" target="_blank" rel="noopener">Photon by Komoot</a>: place search</li>
        <li><a href="https://mediabunny.dev" target="_blank" rel="noopener">Mediabunny</a>: making the videos</li>
        <li>
          <a href="https://magenta.tensorflow.org/datasets/groove" target="_blank" rel="noopener">Groove MIDI Dataset</a> by Google Magenta (<a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noopener">CC BY 4.0</a
          >): the Afrobeat, Funk and Latin beats, from real drummers' playing
        </li>
        <li>Courier Prime: the type</li>
      </ul>
    </details>
  </div>

  <footer>
    <p>Questions, or want a BeatVox taken down? <a class="mail" href="mailto:hello@beatvox.app">hello@beatvox.app</a></p>
    <p class="small">© 2026 Halsey Burgund · BeatVox v2</p>
  </footer>
</div>

<style>
  .about {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  p,
  dd,
  li {
    font: 15px/1.5 var(--sans);
    color: #3c382f;
  }
  p {
    margin: 0;
  }
  h2 {
    margin: 0 0 10px;
    font: 700 30px/1.05 var(--mono);
    text-shadow: 2px 2px 0 var(--pink);
  }
  h3 {
    margin: 0 0 10px;
    font-size: 12px;
  }
  .box {
    padding: 14px 16px 16px;
  }
  .steps {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .steps li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }
  .steps b {
    display: block;
    font: 700 15px var(--mono);
    color: var(--ink);
  }
  .steps .d {
    display: block;
    font-size: 14px;
  }
  .num {
    width: 26px;
    height: 26px;
    flex: none;
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 4px;
    background: var(--yellow);
    font: 700 13px var(--mono);
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  figure {
    margin: 0 0 12px;
  }
  figure img {
    display: block;
    width: 100%;
    max-width: 480px; /* a small 2008 photo: past this it goes soft */
    height: auto;
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 6px;
  }
  figcaption {
    margin-top: 6px;
    font: 12px var(--mono);
    color: var(--muted);
  }
  .maker .name {
    font: 700 20px var(--mono);
    color: var(--ink);
    margin: -4px 0 6px;
  }
  .about p a,
  .about dd a,
  .about li a,
  .mail {
    font-weight: 700;
    color: var(--ink);
  }
  .credits a {
    font: 700 14px var(--mono);
    color: var(--ink);
  }
  details {
    border-top: 2px solid var(--ink);
  }
  .folds {
    border-bottom: 2px solid var(--ink);
  }
  summary {
    min-height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font: 700 17px var(--mono);
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  /* the + / − box */
  .pm {
    width: 30px;
    height: 30px;
    flex: none;
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-radius: 6px;
    background: var(--card);
    position: relative;
  }
  .pm::before,
  .pm::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 12px;
    height: 2.5px;
    background: var(--ink);
    transform: translate(-50%, -50%);
  }
  .pm::after {
    transform: translate(-50%, -50%) rotate(90deg);
  }
  details[open] .pm::after {
    display: none;
  }
  dl {
    margin: 0 0 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  dt {
    font: 700 15px var(--mono);
    margin-top: 8px;
  }
  dt:first-child {
    margin-top: 0;
  }
  dd {
    margin: 0;
  }
  ul {
    margin: 0 0 18px;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .credits {
    list-style: none;
    padding: 0;
  }
  footer {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .small {
    font: 12px var(--mono);
    color: var(--muted);
  }
</style>
