<script lang="ts">
  // The welcome card on a first visit to the map: what the dots are, then
  // LISTEN (starts Wander), MAKE YOURS, or the About page. Shown once.
  import { STUDIO_PATH } from '../lib/roundware';
  import { about } from '../about/aboutState.svelte';

  let { canListen, onlisten, onclose }: { canListen: boolean; onlisten: () => void; onclose: () => void } = $props();

  // the tiny "your voice → sliced → a beat" picture
  const wave = [3, 6, 11, 8, 4, 9, 12, 5, 3, 7, 10, 4];
  // the same waveform cut into three slices: pulled apart, one color each
  const SLICE_COLORS = ['var(--blue)', 'var(--pink)', 'var(--yellow)'];
  const sliced = wave.map((h, i) => ({ x: i * 4 + Math.floor(i / 4) * 5, h, fill: SLICE_COLORS[Math.floor(i / 4)] }));
  // the loop clock, cut down to 8 steps so it reads at this size
  const clock = Array.from({ length: 8 }, (_, k) => ({
    x: 15 + 11 * Math.sin((k * Math.PI) / 4) - 3,
    y: 15 - 11 * Math.cos((k * Math.PI) / 4) - 3,
    on: k === 0 || k === 3 || k === 4 || k === 6,
  }));
</script>

<section class="welcome" aria-labelledby="welcome-title">
  <div class="top">
    <h2 id="welcome-title">Putting rhythm<br />into your voice.</h2>
    <button class="btn close" aria-label="Close" onclick={onclose}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2.4" /></svg>
    </button>
  </div>
  <p>Every dot on this map is a beat someone made from a few seconds of their own voice. BeatVox cuts the voice into slices and plays them like a drum machine.</p>

  <div class="how" aria-hidden="true">
    <span class="step">
      <svg width="48" height="28" viewBox="0 0 48 28">
        {#each wave as h, i (i)}<rect x={i * 4} y={14 - h} width="2.4" height={2 * h} fill="var(--blue)" />{/each}
      </svg>
      YOUR VOICE
    </span>
    <svg class="arrow" width="18" height="10" viewBox="0 0 18 10"><path d="M1 5h14M11 1l4 4-4 4" stroke="var(--muted)" stroke-width="1.8" fill="none" /></svg>
    <span class="step">
      <svg width="58" height="28" viewBox="0 0 58 28">
        {#each sliced as b, i (i)}<rect x={b.x} y={14 - b.h} width="2.4" height={2 * b.h} fill={b.fill} stroke="var(--ink)" stroke-width="0.6" />{/each}
      </svg>
      SLICED
    </span>
    <svg class="arrow" width="18" height="10" viewBox="0 0 18 10"><path d="M1 5h14M11 1l4 4-4 4" stroke="var(--muted)" stroke-width="1.8" fill="none" /></svg>
    <span class="step">
      <svg width="30" height="30" viewBox="0 0 30 30">
        {#each clock as c, k (k)}<rect x={c.x} y={c.y} width="6" height="6" fill={c.on ? 'var(--ink)' : 'var(--card)'} stroke="var(--ink)" stroke-width="1" />{/each}
        <circle cx="15" cy="15" r="5" fill="var(--yellow)" stroke="var(--ink)" stroke-width="1.4" />
      </svg>
      A BEAT
    </span>
  </div>

  <div class="actions">
    <button class="btn listen" disabled={!canListen} onclick={onlisten}>
      <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 2l11 7-11 7z" fill="currentColor" /></svg> LISTEN
    </button>
    <a class="btn primary" href={STUDIO_PATH} onclick={onclose}>MAKE YOURS</a>
  </div>
  <p class="hint">LISTEN plays beats from around the world, one after another.</p>
  <button class="link about" onclick={() => about.show()}>What is BeatVox? About the project →</button>
</section>

<style>
  .welcome {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    z-index: 4;
    box-sizing: border-box;
    max-width: 420px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: var(--card);
    border: 2px solid var(--ink);
    border-radius: 12px;
    box-shadow: 5px 5px 0 var(--ink);
    animation: rise 260ms ease;
  }
  .top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  h2 {
    margin: 4px 0 0;
    font: 700 24px/1.1 var(--mono);
  }
  .close {
    width: 44px;
    padding: 0;
    flex: none;
  }
  p {
    margin: 0;
    font: 14px/1.45 var(--sans);
    color: #3c382f;
  }
  .how {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 2px 0;
  }
  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font: 700 10.5px var(--mono);
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .actions {
    display: flex;
    gap: 10px;
  }
  .actions .btn {
    flex: 1;
    min-height: 50px;
    font-size: 15px;
    text-decoration: none;
    color: var(--ink);
  }
  .listen {
    background: var(--yellow);
  }
  .hint {
    margin-top: -2px;
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }
  .about {
    align-self: center;
    font-weight: 700;
  }
  /* a bigger screen: in the corner, the globe still in view */
  @media (min-width: 900px) {
    .welcome {
      left: 24px;
      right: auto;
      bottom: 88px;
      width: 380px;
      padding: 20px;
    }
  }
  @keyframes rise {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .welcome {
      animation: none;
    }
  }
</style>
