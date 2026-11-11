<script lang="ts">
  // Dev only: audition style beats pulled from the Groove MIDI Dataset (see
  // dev/grooves.ts) with the voice that's loaded, and keep the good ones.
  // Picks save to ../sources/groove-picks.json, beside the repo.
  // Keys: [ and ] for the previous and next, K to keep or un-keep.
  import type { Recipe } from '../lib/recipe';
  import type { Session } from './session.svelte';

  interface Candidate {
    id: string;
    style: string;
    genre: string;
    drummer: string;
    bpm: number;
    bars: number;
    steady: number;
    recipe: Recipe;
  }
  interface Pick {
    id: string;
    style: string;
    genre: string;
    drummer: string;
    note?: string;
    recipe: Recipe;
  }

  let { s }: { s: Session } = $props();

  let all = $state.raw<Candidate[]>([]);
  let picks = $state.raw<Pick[]>([]);
  let genre = $state('');
  let at = $state(0);
  let open = $state(false);
  let saving = $state('');

  void Promise.all([fetch('/__grooves/candidates').then((r) => r.json()), fetch('/__grooves/picks').then((r) => r.json())])
    .then(([c, p]) => {
      all = c;
      picks = p;
      genre = c[0]?.genre ?? '';
    })
    .catch(() => {});

  const genres = $derived([...new Set(all.map((c) => c.genre))].map((g) => [g, all.filter((c) => c.genre === g).length] as const));
  const list = $derived(all.filter((c) => c.genre === genre));
  const cur = $derived(list[Math.min(at, list.length - 1)]);
  const kept = $derived(new Set(picks.map((p) => p.id)));
  const ready = $derived(s.slices.length > 0);

  function play(i: number) {
    at = (i + list.length) % list.length;
    const c = list[at];
    if (c && ready) {
      s.applyRecipe(c.recipe);
      if (!s.playing) s.go();
    }
  }

  async function keep() {
    if (!cur) return;
    picks = kept.has(cur.id)
      ? picks.filter((p) => p.id !== cur.id)
      : [...picks, { id: cur.id, style: cur.style, genre: cur.genre, drummer: cur.drummer, recipe: cur.recipe }];
    saving = 'saving…';
    try {
      const r = await fetch('/__grooves/picks', { method: 'POST', body: JSON.stringify(picks) });
      saving = r.ok ? `saved (${picks.length} kept)` : "couldn't save";
    } catch {
      saving = "couldn't save";
    }
  }

  function key(e: KeyboardEvent) {
    if (!open || (e.target instanceof Element && e.target.closest('input, select, textarea'))) return;
    if (e.key === ']') play(at + 1);
    else if (e.key === '[') play(at - 1);
    else if (e.key === 'k' || e.key === 'K') void keep();
    else return;
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={key} />

{#if all.length}
  <section class="card audition" aria-label="Groove audition (dev)">
    <button class="head" aria-expanded={open} onclick={() => (open = !open)}>
      <span class="label">GROOVE AUDITION <span class="dev">dev</span></span>
      <span class="meta">{all.length} grooves · {picks.length} kept {open ? '▴' : '▾'}</span>
    </button>
    {#if open}
      <div class="row">
        <select
          bind:value={genre}
          onchange={() => {
            at = 0;
            play(0);
          }}
        >
          {#each genres as [g, n] (g)}
            <option value={g}>{g} ({n}) · {picks.filter((p) => p.genre === g).length} kept</option>
          {/each}
        </select>
      </div>
      {#if cur}
        <div class="row">
          <button class="btn small" onclick={() => play(at - 1)} aria-label="Previous groove">‹ [</button>
          <button class="btn small primary" disabled={!ready} onclick={() => play(at)}>PLAY</button>
          <button class="btn small" onclick={() => play(at + 1)} aria-label="Next groove">] ›</button>
          <button class="btn small keep" class:on={kept.has(cur.id)} onclick={keep}>{kept.has(cur.id) ? 'KEPT ✓' : 'KEEP (K)'}</button>
        </div>
        <p class="meta">
          <b>{at + 1} / {list.length}</b> · {cur.style} · {cur.bpm} BPM{cur.recipe.swing ? ` · swing ${cur.recipe.swing}` : ''} · {cur.drummer} · held {cur.steady} of
          {cur.bars} bars
        </p>
        <pre>{cur.recipe.voices.map((v) => `${(v.role ?? '').padEnd(6)}${v.pattern}  ${v.level}`).join('\n')}</pre>
        {#if !ready}<p class="meta">Load or record a voice to hear them.</p>{/if}
        {#if saving}<p class="meta">{saving}</p>{/if}
      {/if}
    {/if}
  </section>
{/if}

<style>
  .audition {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-style: dashed;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: none;
    background: none;
    padding: 0;
    min-height: 32px;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .dev {
    font-size: 11px;
    color: var(--muted);
  }
  .row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  select {
    min-height: 40px;
    flex: 1;
    font: 14px var(--mono);
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    background: var(--card);
  }
  .btn.small {
    min-height: 40px;
    padding: 0 10px;
    font-size: 13px;
  }
  .keep {
    margin-left: auto;
  }
  .keep.on {
    background: var(--yellow);
  }
  .meta {
    font-size: 13px;
    color: var(--muted);
    margin: 0;
  }
  pre {
    margin: 0;
    font: 13px/1.4 var(--mono);
    overflow-x: auto;
  }
</style>
