<script lang="ts">
  // One row's place in the stereo field (the Pan view). The toggle flips the
  // row between FIXED (one handle: drag to place it, it stays there) and ROAM
  // (two handles: it wanders between them). Left of the bar is left. A small
  // dot shows where the row is right now. Arrow keys move the focused handle.
  import type { PanSetting } from '../audio/engine';

  interface Props {
    label: string;
    pan: PanSetting;
    /** where the row is now, -1..1, or null when stopped */
    live?: number | null;
    disabled?: boolean;
    onchange: (p: Partial<PanSetting>) => void;
  }
  let { label, pan, live = null, disabled = false, onchange }: Props = $props();

  let el: HTMLDivElement;
  /** the handle being dragged */
  let dragging: 'at' | 'lo' | 'hi' | null = null;

  const pos = (p: number) => `${((p + 1) / 2) * 100}%`;
  const clamp = (x: number) => Math.min(1, Math.max(-1, x));
  /** L40, C, R25 */
  const say = (p: number) => (Math.abs(p) < 0.005 ? 'centre' : `${p < 0 ? 'left' : 'right'} ${Math.round(Math.abs(p) * 100)}`);

  function valueAt(e: PointerEvent) {
    const r = el.getBoundingClientRect();
    const p = clamp(((e.clientX - r.left) / r.width) * 2 - 1);
    // the middle is sticky, so it's easy to put a row back in the centre
    return Math.abs(p) < 0.05 ? 0 : Math.round(p * 100) / 100;
  }
  function set(which: 'at' | 'lo' | 'hi', p: number) {
    if (which === 'at') onchange({ at: p });
    else if (which === 'lo') onchange({ lo: Math.min(p, pan.hi) });
    else onchange({ hi: Math.max(p, pan.lo) });
  }
  function down(e: PointerEvent) {
    if (disabled) return;
    const p = valueAt(e);
    if (pan.mode === 'fixed') dragging = 'at';
    // the nearer end; between two ends at one spot, the side you pressed on
    else if (pan.lo === pan.hi) dragging = p < pan.lo ? 'lo' : 'hi';
    else dragging = Math.abs(p - pan.lo) <= Math.abs(p - pan.hi) ? 'lo' : 'hi';
    el.setPointerCapture(e.pointerId);
    set(dragging, p);
  }
  function move(e: PointerEvent) {
    if (dragging && el.hasPointerCapture(e.pointerId)) set(dragging, valueAt(e));
  }
  function up() {
    dragging = null;
  }
  function key(which: 'at' | 'lo' | 'hi', e: KeyboardEvent) {
    const d = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2 }[e.key];
    const to = e.key === 'Home' ? -1 : e.key === 'End' ? 1 : d === undefined ? null : clamp(Math.round((pan[which] + d) * 100) / 100);
    if (to === null || disabled) return;
    e.preventDefault();
    e.stopPropagation();
    set(which, to);
  }
</script>

<div class="pan" class:roam={pan.mode === 'roam'}>
  <button
    class="mode"
    {disabled}
    aria-label="{label}: {pan.mode === 'fixed' ? 'fixed in place' : 'roaming'}. Switch to {pan.mode === 'fixed' ? 'roam' : 'fixed'}"
    onclick={() => onchange({ mode: pan.mode === 'fixed' ? 'roam' : 'fixed' })}>{pan.mode === 'fixed' ? 'FIXED' : 'ROAM'}</button
  >
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div bind:this={el} class="bar" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
    <span class="mid" aria-hidden="true"></span>
    {#if pan.mode === 'fixed'}
      <span class="fill" style="left:{pos(Math.min(0, pan.at))};right:{`calc(100% - ${pos(Math.max(0, pan.at))})`}" aria-hidden="true"></span>
      {@render handle('at', `${label} position`)}
    {:else}
      <span class="fill" style="left:{pos(pan.lo)};right:{`calc(100% - ${pos(pan.hi)})`}" aria-hidden="true"></span>
      {@render handle('lo', `${label} roams from`)}
      {@render handle('hi', `${label} roams to`)}
    {/if}
    {#if live !== null}<span class="live" style="left:{pos(live)}" aria-hidden="true"></span>{/if}
  </div>
</div>

{#snippet handle(which: 'at' | 'lo' | 'hi', name: string)}
  <span
    class="handle {which}"
    style="left:{pos(pan[which])}"
    role="slider"
    tabindex={disabled ? -1 : 0}
    aria-label={name}
    aria-valuemin={-100}
    aria-valuemax={100}
    aria-valuenow={Math.round(pan[which] * 100)}
    aria-valuetext={say(pan[which])}
    aria-disabled={disabled}
    onkeydown={(e) => key(which, e)}
  ></span>
{/snippet}

<style>
  .pan {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .mode {
    flex: none;
    width: 52px;
    height: 24px;
    padding: 0;
    border: 1.5px solid var(--ink);
    border-radius: 3px;
    background: var(--card);
    color: var(--ink);
    font: 700 11px var(--mono);
    cursor: pointer;
  }
  .roam .mode {
    background: var(--yellow);
  }
  .bar {
    flex: 1;
    height: 24px;
    box-sizing: border-box;
    border: 1.5px solid var(--ink);
    border-radius: 3px;
    background: var(--card);
    position: relative;
    overflow: hidden;
    cursor: ew-resize;
    touch-action: none;
  }
  .mid {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    border-left: 1.5px dashed var(--soft);
  }
  .fill {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--blue);
    opacity: 0.35;
  }
  .roam .fill {
    opacity: 1;
  }
  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    margin-left: -2px;
    background: var(--pink);
    outline: none;
  }
  .handle.at {
    width: 6px;
    margin-left: -3px;
    background: var(--blue);
    box-shadow: 0 0 0 1.5px var(--ink);
  }
  .handle:focus-visible {
    box-shadow: 0 0 0 2px var(--ink);
  }
  .live {
    position: absolute;
    top: 50%;
    width: 8px;
    height: 8px;
    margin: -4px 0 0 -4px;
    border-radius: 50%;
    background: var(--ink);
    border: 1.5px solid var(--card);
    pointer-events: none;
  }
  .mode:disabled,
  .bar:has(.handle[aria-disabled='true']) {
    cursor: default;
  }
</style>
