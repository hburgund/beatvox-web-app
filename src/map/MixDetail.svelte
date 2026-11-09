<script lang="ts">
  // One mix's details on the map: its ring (which is its loop player), the
  // source vox, the other beats made from the same vox, its page and reVox.
  // Shown in a sheet on a phone and a side panel on a bigger screen.
  import Ring from '../lib/ui/Ring.svelte';
  import MiniClock from '../lib/ui/MiniClock.svelte';
  import { loadShared, ringRows, type Shared, type SharedMix } from '../lib/shared';
  import { beatvoxShareUrl, revoxUrl, STUDIO_PATH } from '../lib/roundware';
  import type { Player } from '../share/player.svelte';
  import type { MapMix } from '../lib/mapData';

  interface Props {
    mix: MapMix;
    player: Player;
    /** wandering: this mix plays once, then the next one */
    wandering: boolean;
    ringSize: number;
    onplay: (m: SharedMix) => void;
    onpick: (id: number) => void;
    onclose: () => void;
  }
  let { mix, player, wandering, ringSize, onplay, onpick, onclose }: Props = $props();

  let info = $state<Shared | null>(null);
  let failed = $state(false);

  $effect(() => {
    const id = mix.id;
    let gone = false;
    info = null;
    failed = false;
    loadShared(id)
      .then((d) => {
        if (!gone) info = d;
      })
      .catch(() => {
        if (!gone) failed = true;
      });
    return () => {
      gone = true;
    };
  });

  const live = $derived(info?.status === 'live' ? info : null);
  const key = $derived(`mix${mix.id}`);
  const rows = $derived(ringRows(live?.mix.recipe ?? null));
  const source = $derived(live?.mix.recipe?.revoxOf ? (live.family.find((m) => m.id === live.mix.recipe!.revoxOf) ?? null) : null);
  const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<div class="detail">
  <div class="top">
    <div class="names">
      <p class="label kicker">{mix.revox ? 'A REVOX' : 'A BEATVOX'} · {day(mix.createdAt).toUpperCase()}</p>
      <h2>{mix.title}</h2>
      {#if source}<p class="sub">made with the vox from <button class="link" onclick={() => onpick(source.id)}>{source.title}</button></p>{/if}
    </div>
    <button class="btn icon" aria-label="Close" onclick={onclose}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2.4" /></svg>
    </button>
  </div>

  {#if failed}
    <p class="sub">Couldn't load this BeatVox. Check your connection and try again.</p>
  {:else if info && !live}
    <p class="sub">This BeatVox isn't available right now.</p>
  {:else}
    <div class="ring">
      <Ring {rows} step={player.playing === key ? player.step : -1} size={ringSize} label="The beat as a circle">
        <button
          class="play"
          disabled={!live}
          aria-label={player.playing === key ? 'Stop the beat' : 'Play the beat'}
          aria-pressed={player.playing === key}
          onclick={() => live && onplay(live.mix)}
        >
          {#if player.loading === key || !live}
            <span class="spin" aria-hidden="true"></span>
          {:else if player.playing === key}
            <svg width="22" height="22" viewBox="0 0 20 20" aria-hidden="true"
              ><rect x="4" y="3" width="4.5" height="14" fill="currentColor" /><rect x="11.5" y="3" width="4.5" height="14" fill="currentColor" /></svg
            >
          {:else}
            <svg width="26" height="26" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 2l11 7-11 7z" fill="currentColor" /></svg>
          {/if}
        </button>
      </Ring>
    </div>
    {#if wandering && player.playing === key}<p class="sub center">Wandering: the next one starts when this one ends.</p>{/if}

    {#if live}
      <div class="vox">
        <button
          class="vox-play"
          aria-label={player.playing === `vox${live.vox.id}` ? 'Stop the source vox' : 'Hear the source vox'}
          aria-pressed={player.playing === `vox${live.vox.id}`}
          onclick={() => player.toggle(`vox${live.vox.id}`, live.vox.file, { loop: false })}
        >
          {#if player.playing === `vox${live.vox.id}`}
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" fill="currentColor" /></svg>
          {:else}
            <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 2l11 7-11 7z" fill="currentColor" /></svg>
          {/if}
        </button>
        <div>
          <p class="label">THE SOURCE VOX</p>
          <p class="sub">the recording these beats are made from</p>
        </div>
      </div>

      {#if live.family.length > 1}
        <div class="family">
          <p class="label">THIS VOX · {live.family.length} BEATS</p>
          <ul>
            {#each live.family as m (m.id)}
              {@const k = `mix${m.id}`}
              <li>
                <MiniClock
                  rows={ringRows(m.recipe)}
                  current={m.id === mix.id}
                  playing={player.playing === k}
                  loading={player.loading === k}
                  step={player.playing === k ? player.step : -1}
                  label={player.playing === k ? `Stop ${m.title}` : `Play ${m.title}`}
                  onclick={() => (m.id === mix.id ? onplay(m) : onpick(m.id))}
                />
                <span class="fam-name">{m.title}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="actions">
        <a class="btn" href={beatvoxShareUrl(mix.id)}>OPEN ITS PAGE</a>
        {#if live.revoxAllowed}
          <a class="btn primary" href={revoxUrl(mix.id)}>REVOX THIS VOX</a>
        {:else}
          <a class="btn primary" href={STUDIO_PATH}>MAKE YOUR OWN</a>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .detail {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }
  .names {
    min-width: 0;
  }
  p {
    margin: 0;
  }
  h2 {
    margin: 2px 0 0;
    font: 700 24px/1.1 var(--mono);
    overflow-wrap: anywhere;
  }
  .kicker {
    font-size: 12px;
    color: var(--muted);
  }
  .sub {
    font: 13px/1.35 var(--sans);
    color: var(--muted);
  }
  .sub .link {
    font: 600 13px var(--sans);
    color: var(--ink);
    min-height: 0;
  }
  .center {
    text-align: center;
  }
  .btn.icon {
    width: 44px;
    padding: 0;
    flex: none;
  }
  .ring {
    align-self: center;
  }
  .play {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 3px solid var(--ink);
    background: var(--yellow);
    color: var(--ink);
    box-shadow: 3px 3px 0 var(--pink);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    touch-action: manipulation;
  }
  .play:disabled {
    cursor: default;
  }
  .spin {
    width: 20px;
    height: 20px;
    border: 3px solid var(--ink);
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .vox {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .vox-play {
    width: 44px;
    height: 44px;
    flex: none;
    border-radius: 50%;
    border: 2.5px solid var(--ink);
    background: var(--card);
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .vox-play[aria-pressed='true'] {
    background: var(--yellow);
  }
  .family ul {
    list-style: none;
    margin: 6px 0 0;
    padding: 0;
    display: flex;
    gap: 8px;
    overflow-x: auto;
  }
  .family li {
    flex: none;
    width: 76px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .fam-name {
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .actions {
    display: flex;
    gap: 10px;
  }
  .actions .btn {
    flex: 1;
    min-height: 48px;
    text-decoration: none;
    color: var(--ink);
    text-align: center;
  }
  @media (prefers-reduced-motion: reduce) {
    .spin {
      animation: none;
    }
  }
</style>
