<script lang="ts">
  // The record display: blue waveform with a line at each slice, like v1.93.
  import type { Slice } from '../audio/slicer';

  interface Props {
    mono: Float32Array | null;
    sampleRate: number;
    slices: Slice[];
    /** 0..1 playhead, or < 0 for none */
    position?: number;
    /** live input level 0..1 while recording */
    level?: number;
    recording?: boolean;
    height?: number;
  }
  let { mono, sampleRate, slices, position = -1, level = 0, recording = false, height = 110 }: Props = $props();

  let canvas: HTMLCanvasElement;
  let width = $state(600);

  function draw() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#6f97e0';
    g.fillRect(0, 0, width, height);
    const mid = height / 2;
    if (mono && mono.length) {
      const dur = mono.length / sampleRate;
      g.fillStyle = '#1d3fb8';
      const per = mono.length / width;
      for (let px = 0; px < width; px++) {
        let lo = 0, hi = 0;
        const a = Math.floor(px * per), b = Math.min(mono.length, Math.floor((px + 1) * per));
        for (let k = a; k < b; k++) {
          const v = mono[k];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        g.fillRect(px, mid - hi * mid * 0.92, 1, Math.max(1, (hi - lo) * mid * 0.92));
      }
      g.fillStyle = 'rgba(30,30,40,0.55)';
      for (const s of slices) g.fillRect(Math.round((s.start / dur) * width), 0, 1, height);
      if (position >= 0) {
        g.fillStyle = '#fff';
        g.fillRect(Math.round(position * width), 0, 2, height);
      }
    } else {
      g.fillStyle = 'rgba(29,63,184,0.7)';
      g.fillRect(0, mid, width, 1);
    }
  }

  $effect(() => {
    void [mono, slices, position, width, height];
    draw();
  });
</script>

<div class="level" aria-hidden="true">
  <span class="fill" style="width:{Math.min(100, Math.sqrt(level) * 110)}%"></span>
  <span class="text">{recording ? 'Recording…' : 'Recording Level'}</span>
</div>
<div class="wrap" bind:clientWidth={width}>
  <canvas bind:this={canvas} style="height:{height}px" aria-label="Recorded waveform with {slices.length} slices"></canvas>
</div>

<style>
  .level {
    position: relative;
    height: 20px;
    background: #555;
    border: 1px solid #333;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: linear-gradient(90deg, #5ad45a, #c8e04a 70%, #e05a3a);
    transition: width 50ms linear;
  }
  .text {
    position: relative;
    display: block;
    text-align: center;
    font: bold 11px/20px Arial, sans-serif;
    color: #fff;
    text-shadow: 0 1px 1px #000;
  }
  .wrap {
    width: 100%;
  }
  canvas {
    display: block;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #333;
  }
</style>
