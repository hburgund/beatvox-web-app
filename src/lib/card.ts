// A BeatVox's share card: the picture link previews show. The beat's ring on
// the left (8 rings of 16 steps, hits colored by sound, as on the share page),
// BEATVOX and the title on the right, 1200 × 630 (the usual preview shape).
//
// Animated as a GIF of 16 frames, one per step, so one loop is one bar: the
// wedge goes round and the hits on its step burst (bigger, a heavier edge).
// Apps that show only the first frame (iMessage) still get the whole ring.
// Drawn and encoded in the browser when a BeatVox is sent; nothing on a
// server draws it.
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import type { RingRow } from './shared';

export const CARD_W = 1200;
export const CARD_H = 630;

const C = {
  paper: '#f4efe2',
  card: '#fffcf4',
  ink: '#1d1b16',
  muted: '#5d584c',
  soft: '#cfc7b3',
  blue: '#2a35c9',
  pink: '#ff5c80',
  yellow: '#ffd23f',
};
const FILL: Record<string, string> = { kick: C.blue, snare: C.pink, hat: C.yellow };
const FONT = "'Courier Prime', 'Courier New', monospace";

export interface CardText {
  title: string;
}

/** Draw one frame: the wedge and bursting hits on `step` (or none for -1). */
export function drawCard(g: CanvasRenderingContext2D, rows: RingRow[], text: CardText, step: number) {
  g.fillStyle = C.paper;
  g.fillRect(0, 0, CARD_W, CARD_H);

  // the ring, as Ring.svelte draws it (R = 100 units, scaled)
  const cx = 330;
  const cy = CARD_H / 2;
  const size = 540;
  const k = size / 200;
  const R = 100;
  const r0 = R * 0.36;
  const band = (R - r0) / 8;
  if (step >= 0) {
    const a0 = ((step - 0.5) / 16) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((step + 0.5) / 16) * 2 * Math.PI - Math.PI / 2;
    g.beginPath();
    g.arc(cx, cy, R * k, a0, a1);
    g.arc(cx, cy, (r0 - 2) * k, a1, a0, true);
    g.closePath();
    g.fillStyle = 'rgba(255,210,63,0.45)';
    g.fill();
  }
  rows.forEach((row, i) => {
    const rad = R - band * (i + 0.5);
    const s = Math.min(band * 0.8, ((2 * Math.PI * rad) / 16) * 0.64);
    row.hits.forEach((hit, kk) => {
      const a = (kk / 16) * 2 * Math.PI;
      const x = cx + rad * Math.sin(a) * k;
      const y = cy - rad * Math.cos(a) * k;
      const burst = hit && row.on && kk === step;
      const side = s * k * (burst ? 1.35 : 1);
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.globalAlpha = hit && !row.on ? 0.3 : 1;
      g.fillStyle = hit ? (FILL[row.sound ?? ''] ?? C.ink) : kk % 4 === 0 ? C.paper : C.card;
      g.strokeStyle = hit ? C.ink : C.soft;
      g.lineWidth = hit ? (burst ? 4 : 2) : 1.5;
      const r = side * 0.14;
      g.beginPath();
      g.roundRect(-side / 2, -side / 2, side, side, r);
      g.fill();
      g.stroke();
      g.restore();
    });
  });
  // the play button in the middle
  g.fillStyle = C.pink;
  g.beginPath();
  g.arc(cx + 5, cy + 5, 64, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = C.yellow;
  g.strokeStyle = C.ink;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(cx, cy, 64, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = C.ink;
  g.beginPath();
  g.moveTo(cx - 16, cy - 26);
  g.lineTo(cx + 28, cy);
  g.lineTo(cx - 16, cy + 26);
  g.closePath();
  g.fill();

  // the words
  const x = 660;
  g.textBaseline = 'alphabetic';
  g.font = `700 64px ${FONT}`;
  g.fillStyle = C.pink;
  g.fillText('BEATVOX', x + 4, 140 + 4);
  g.fillStyle = C.ink;
  g.fillText('BEATVOX', x, 140);
  g.font = `700 54px ${FONT}`;
  g.fillStyle = C.ink;
  wrap(g, text.title || 'Untitled', 500, 3).forEach((line, i) => g.fillText(line, x, 250 + i * 62));
  g.font = `400 24px ${FONT}`;
  g.fillStyle = C.muted;
  g.fillText('a beat made from one voice', x, 540);
}

/** Up to `max` lines of `text` no wider than `width`, the last cut with … */
function wrap(g: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    let last = kept[max - 1];
    while (last.length > 1 && g.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    kept[max - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

/** The animated card as a GIF: 16 frames, one step each, at the beat's tempo. */
export async function makeCardGif(rows: RingRow[], text: CardText, bpm: number): Promise<Blob> {
  await document.fonts.load(`700 54px 'Courier Prime'`).catch(() => {});
  await document.fonts.load(`400 24px 'Courier Prime'`).catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  const frames: Uint8ClampedArray[] = [];
  for (let step = 0; step < 16; step++) {
    drawCard(g, rows, text, step);
    frames.push(g.getImageData(0, 0, CARD_W, CARD_H).data);
    // let the page breathe between frames
    await new Promise((r) => setTimeout(r, 0));
  }
  // one palette for every frame (they share their colors), from the first
  const palette = quantize(frames[0], 128);
  const gif = GIFEncoder();
  const delay = Math.max(20, Math.round((60 / bpm / 4) * 1000));
  frames.forEach((rgba, i) => {
    gif.writeFrame(applyPalette(rgba, palette), CARD_W, CARD_H, i === 0 ? { palette, delay, repeat: 0 } : { delay });
  });
  gif.finish();
  return new Blob([new Uint8Array(gif.bytes())], { type: "image/gif" });
}
