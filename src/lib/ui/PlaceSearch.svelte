<script lang="ts">
  // Type a place and pick it from the suggestions (an ARIA combobox): up and
  // down move through them, Enter picks, Escape closes. Searches start after
  // 3 letters and wait for a pause in typing.
  import { searchPlaces, type FoundPlace } from '../geocode';

  interface Props {
    /** prefer places near here (where the map is looking) */
    near?: () => { latitude: number; longitude: number } | undefined;
    onpick: (p: FoundPlace) => void;
    /** what's typed (bindable, so the picker can clear it) */
    query?: string;
  }
  let { near, onpick, query = $bindable('') }: Props = $props();

  const id = `places-${Math.random().toString(36).slice(2, 8)}`;
  let found = $state.raw<FoundPlace[]>([]);
  let open = $state(false);
  let active = $state(-1);
  let busy = $state(false);
  let note = $state('');
  let timer = 0;
  let ctl: AbortController | null = null;

  function typed() {
    clearTimeout(timer);
    ctl?.abort();
    note = '';
    const text = query.trim();
    if (text.length < 3) {
      found = [];
      open = false;
      busy = false;
      return;
    }
    busy = true;
    timer = window.setTimeout(async () => {
      ctl = new AbortController();
      try {
        found = await searchPlaces(text, { near: near?.(), signal: ctl.signal });
        open = true;
        active = found.length ? 0 : -1;
        if (!found.length) note = 'No places by that name. Try another spelling, or tap the map.';
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          note = "Couldn't search just now. Tap the map instead.";
          open = false;
        }
      } finally {
        busy = false;
      }
    }, 300);
  }

  function pick(p: FoundPlace) {
    query = p.label;
    open = false;
    found = [];
    onpick(p);
  }

  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' && found.length) {
      e.preventDefault();
      open = true;
      active = (active + 1) % found.length;
    } else if (e.key === 'ArrowUp' && found.length) {
      e.preventDefault();
      active = (active - 1 + found.length) % found.length;
    } else if (e.key === 'Enter' && open && found[active]) {
      e.preventDefault();
      pick(found[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      open = false;
    }
  }
</script>

<div class="search">
  <label class="sr-only" for={id}>Find a place</label>
  <input
    {id}
    type="search"
    placeholder="search for a place"
    autocomplete="off"
    spellcheck="false"
    role="combobox"
    aria-autocomplete="list"
    aria-expanded={open}
    aria-controls="{id}-list"
    aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
    bind:value={query}
    oninput={typed}
    onkeydown={key}
    onblur={() => setTimeout(() => (open = false), 150)}
    onfocus={() => (open = found.length > 0)}
  />
  {#if busy}<span class="busy" aria-hidden="true"></span>{/if}
  {#if open && found.length}
    <ul id="{id}-list" role="listbox" aria-label="Places">
      {#each found as p, i (p.label)}
        <li
          id="{id}-{i}"
          role="option"
          aria-selected={i === active}
          class:active={i === active}
          onpointerdown={(e) => {
            e.preventDefault();
            pick(p);
          }}
          onpointerenter={() => (active = i)}
        >
          <b>{p.name}</b>{p.label.slice(p.name.length)}
        </li>
      {/each}
    </ul>
  {/if}
  {#if note}<p class="note" aria-live="polite">{note}</p>{/if}
</div>

<style>
  .search {
    position: relative;
  }
  input {
    width: 100%;
    min-height: 44px;
    box-sizing: border-box;
    padding: 0 36px 0 12px;
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    background: var(--card);
    font: 15px var(--sans);
  }
  input:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 1px;
  }
  .busy {
    position: absolute;
    right: 12px;
    top: 14px;
    width: 14px;
    height: 14px;
    box-sizing: border-box;
    border: 2px solid var(--ink);
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  ul {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 4px);
    z-index: 10;
    margin: 0;
    padding: 4px 0;
    list-style: none;
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    background: var(--card);
    box-shadow: 3px 3px 0 var(--blue);
    max-height: 260px;
    overflow-y: auto;
  }
  li {
    padding: 10px 12px;
    font: 14px/1.3 var(--sans);
    color: var(--muted);
    cursor: pointer;
  }
  li b {
    color: var(--ink);
    font-weight: 600;
  }
  li.active {
    background: var(--now);
  }
  .note {
    margin: 6px 0 0;
    font: 12px var(--sans);
    color: var(--muted);
  }
  @media (prefers-reduced-motion: reduce) {
    .busy {
      animation: none;
    }
  }
</style>
