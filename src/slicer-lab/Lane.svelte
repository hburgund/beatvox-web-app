<script lang="ts">
  import type { SliceResult } from '../lib/audio/slicer';

  interface Props {
    label: string;
    hint: string;
    mono: Float32Array;
    sampleRate: number;
    result: SliceResult;
    showCurve: boolean;
    active: boolean;
    onslice: (i: number) => void;
  }
  let { label, hint, mono, sampleRate, result, showCurve, active, onslice }: Props = $props();

  let canvas: HTMLCanvasElement;
  let width = $state(600);
  const HEIGHT = 110;
  const flashes = new Map<number, number>();
  let raf = 0;

  const COLORS = ['#e8b84a', '#7fc97f', '#e07a8f', '#8fa8e0', '#c79bd8', '#6cc4c0'];

  export function flash(i: number) {
    flashes.set(i, performance.now());
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    raf = 0;
    draw();
    if (flashes.size) raf = requestAnimationFrame(tick);
  }

  function draw() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = HEIGHT * dpr;
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dur = mono.length / sampleRate;
    const x = (t: number) => (t / dur) * width;

    // background like the v1.93 record display
    g.fillStyle = '#6f97e0';
    g.fillRect(0, 0, width, HEIGHT);

    // slice regions
    const now = performance.now();
    result.slices.forEach((s, i) => {
      const f = flashes.get(i);
      const age = f === undefined ? Infinity : now - f;
      if (age > 180) flashes.delete(i);
      g.globalAlpha = age < 180 ? 0.85 - (age / 180) * 0.45 : 0.4;
      g.fillStyle = COLORS[i % COLORS.length];
      g.fillRect(x(s.start), 0, Math.max(1, x(s.end) - x(s.start)), HEIGHT);
    });
    g.globalAlpha = 1;

    // waveform (min/max per pixel)
    g.fillStyle = '#1d3fb8';
    const mid = HEIGHT / 2;
    const per = mono.length / width;
    for (let px = 0; px < width; px++) {
      let lo = 0, hi = 0;
      const a = Math.floor(px * per), b = Math.floor((px + 1) * per);
      for (let k = a; k < b; k++) {
        const v = mono[k];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      g.fillRect(px, mid - hi * mid * 0.92, 1, Math.max(1, (hi - lo) * mid * 0.92));
    }

    // detection curve
    if (showCurve) {
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 1;
      g.beginPath();
      const c = result.curve;
      for (let i = 0; i < c.length; i++) {
        const px = x(i * result.frameDur);
        const py = HEIGHT - 2 - c[i] * (HEIGHT - 4);
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }

    // slice start markers + numbers
    g.font = '10px Arial';
    result.slices.forEach((s, i) => {
      g.fillStyle = '#111';
      g.fillRect(Math.round(x(s.start)), 0, 1, HEIGHT);
      g.fillText(String(i + 1), x(s.start) + 2, 10);
    });
  }

  $effect(() => {
    // redraw when any input changes
    void [mono, result, showCurve, width];
    draw();
  });

  function click(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * (mono.length / sampleRate);
    let i = result.slices.findIndex((s) => t >= s.start && t <= s.end);
    if (i < 0) {
      // nearest slice start
      let best = Infinity;
      result.slices.forEach((s, j) => {
        const d = Math.abs(s.start - t);
        if (d < best) { best = d; i = j; }
      });
    }
    if (i >= 0) onslice(i);
  }
</script>

<div class="lane" class:active>
  <div class="head">
    <span class="name">{label}</span>
    <span class="count">{result.slices.length} slices</span>
    <span class="hint">{hint}</span>
  </div>
  <div class="wrap" bind:clientWidth={width}>
    <canvas bind:this={canvas} style="height:{HEIGHT}px" onclick={click}></canvas>
  </div>
</div>

<style>
  .lane {
    border: 1px solid #7a8a99;
    border-radius: 6px;
    background: #dfe8f0;
    padding: 6px 8px 8px;
  }
  .lane.active {
    border-color: #2a7a2a;
    box-shadow: 0 0 0 2px #7fd07f;
  }
  .head {
    display: flex;
    gap: 10px;
    align-items: baseline;
    flex-wrap: wrap;
    margin-bottom: 4px;
  }
  .name { font-weight: bold; }
  .count {
    font-family: 'Courier New', monospace;
    background: #fff;
    border: 1px solid #888;
    padding: 0 4px;
    font-size: 12px;
  }
  .hint { color: #456; font-size: 12px; }
  .wrap { width: 100%; }
  canvas {
    display: block;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #333;
    cursor: pointer;
    touch-action: manipulation;
  }
</style>
