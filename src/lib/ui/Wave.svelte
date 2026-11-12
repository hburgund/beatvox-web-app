<script lang="ts">
  // The voice waveform: pale bars on riso blue, a yellow line at each slice,
  // its number on top, and a white playhead while you hear it back.
  // Tap a slice to hear it. Drag it onto a beat row to make that row play it.
  import type { Slice } from '../audio/slicer';

  interface Props {
    mono: Float32Array | null;
    sampleRate: number;
    slices: Slice[];
    /** 0..1 playhead, or < 0 for none */
    position?: number;
    /** slices playing in the beat right now (they flash) */
    lit?: number[];
    /** slices some beat row plays */
    used?: number[];
    height?: number;
    onslice?: (slice: number) => void;
    /** a slice dropped on a beat row (rows carry data-row) */
    ondrop?: (slice: number, row: number) => void;
    /** the row under a dragged slice, or null */
    onover?: (row: number | null) => void;
  }
  let { mono, sampleRate, slices, position = -1, lit = [], used = [], height = 64, onslice, ondrop, onover }: Props = $props();

  let canvas: HTMLCanvasElement;
  let width = $state(320);
  let pressed = $state(-1);
  let drag = $state<{ slice: number; x: number; y: number } | null>(null);
  let start: { x: number; y: number; slice: number } | null = null;
  const TOP = 16; // the number strip

  const dur = $derived(mono ? mono.length / sampleRate : 1);

  function color(name: string) {
    return getComputedStyle(canvas).getPropertyValue(name).trim();
  }

  function draw() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = color('--blue');
    g.fillRect(0, 0, width, height);
    if (!mono || !mono.length) return;
    const yellow = color('--yellow');
    const pink = color('--pink');
    // slices that are sounding (or tapped) light up
    for (let i = 0; i < slices.length; i++) {
      if (i !== pressed && !lit.includes(i)) continue;
      const x0 = (slices[i].start / dur) * width;
      const x1 = (slices[i].end / dur) * width;
      g.fillStyle = i === pressed ? 'rgba(255,92,128,0.55)' : 'rgba(255,210,63,0.35)';
      g.fillRect(x0, 0, Math.max(2, x1 - x0), height);
    }
    const mid = TOP + (height - TOP) / 2;
    g.fillStyle = color('--wave-bar');
    // bars 2 px wide with a 1 px gap
    const per = (mono.length / width) * 3;
    for (let px = 0; px < width; px += 3) {
      let peak = 0;
      const a = Math.floor((px / 3) * per);
      const b = Math.min(mono.length, Math.floor((px / 3 + 1) * per));
      for (let k = a; k < b; k++) peak = Math.max(peak, Math.abs(mono[k]));
      const h = Math.max(2, peak * (height - TOP - 6));
      g.fillRect(px, mid - h / 2, 2, h);
    }
    g.font = `700 11px ${getComputedStyle(canvas).fontFamily}`;
    g.textBaseline = 'top';
    slices.forEach((s, i) => {
      const x = Math.round((s.start / dur) * width);
      g.fillStyle = yellow;
      g.fillRect(x, 0, 2, height);
      g.fillStyle = i === pressed ? pink : used.includes(i) ? yellow : 'rgba(233,235,255,0.6)';
      g.fillText(String(i + 1), x + 4, 3);
    });
    if (position >= 0) {
      g.fillStyle = '#fff';
      g.fillRect(Math.round(position * width), 0, 2, height);
    }
  }

  $effect(() => {
    void [mono, slices, position, width, height, lit, used, pressed];
    draw();
  });

  function sliceAt(clientX: number) {
    const r = canvas.getBoundingClientRect();
    const t = ((clientX - r.left) / r.width) * dur;
    for (let i = slices.length - 1; i >= 0; i--) if (t >= slices[i].start) return i;
    return slices.length ? 0 : -1;
  }

  function rowAt(x: number, y: number) {
    const el = document.elementFromPoint(x, y)?.closest('[data-row]') as HTMLElement | null;
    return el ? Number(el.dataset.row) : null;
  }

  /** the row highlighted under the dragged slice: where it lands */
  let over: number | null = null;
  let pointer = -1;

  // stop following the pointer if the waveform goes away mid-drag
  $effect(() => () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  });

  function down(e: PointerEvent) {
    const i = sliceAt(e.clientX);
    if (i < 0) return;
    // a mouse press would otherwise start selecting text (or a native drag)
    if (e.pointerType === 'mouse') e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* the window listeners below still follow it */
    }
    // a gesture that never ended properly must not leak into this one
    drag = null;
    over = null;
    pointer = e.pointerId;
    start = { x: e.clientX, y: e.clientY, slice: i };
    pressed = i;
    // follow the pointer on the window too, so the drop still lands if the canvas loses it
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    onslice?.(i);
  }

  function move(e: PointerEvent) {
    if (!start || e.pointerId !== pointer) return;
    if (!drag && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) drag = { slice: start.slice, x: 0, y: 0 };
    if (drag) {
      drag = { slice: drag.slice, x: e.clientX, y: e.clientY };
      // between rows keeps the last one, so the highlight doesn't flicker off
      const row = rowAt(e.clientX, e.clientY);
      if (row !== null || !overGrid(e.clientX, e.clientY)) over = row;
      onover?.(over);
    }
  }

  /** inside the beat grid (rows and the gaps between them) */
  function overGrid(x: number, y: number) {
    return !!document.elementFromPoint(x, y)?.closest('.grid');
  }

  function up(e: PointerEvent) {
    if (e.pointerId !== pointer) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (drag) {
      // the highlighted row is the promise: drop there (a cancel has no reliable position)
      const row = e.type === 'pointerup' ? (rowAt(e.clientX, e.clientY) ?? over) : over;
      if (row !== null) ondrop?.(drag.slice, row);
      onover?.(null);
    }
    drag = null;
    over = null;
    start = null;
    pointer = -1;
    setTimeout(() => (pressed = -1), 120);
  }
</script>

<div class="wrap" bind:clientWidth={width}>
  <canvas
    bind:this={canvas}
    style="height:{height}px"
    aria-label="Your voice, cut into {slices.length} slices. Tap a slice to hear it; drag it onto a beat row."
    onpointerdown={down}
  ></canvas>
</div>
{#if drag && drag.x}
  <div class="chip" style="left:{drag.x}px; top:{drag.y}px" aria-hidden="true">SLICE {drag.slice + 1}</div>
{/if}

<style>
  .wrap {
    width: 100%;
  }
  canvas {
    display: block;
    width: 100%;
    border-radius: 4px;
    cursor: pointer;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    font-family: var(--mono);
  }
  .chip {
    position: fixed;
    z-index: 50;
    transform: translate(-50%, -140%);
    padding: 4px 8px;
    border: 2px solid var(--ink);
    border-radius: var(--radius);
    background: var(--yellow);
    font: 700 13px var(--mono);
    box-shadow: 3px 3px 0 var(--pink);
    pointer-events: none;
    white-space: nowrap;
  }
</style>
