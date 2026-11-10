// One frame of a BeatVox video, drawn on a canvas: the voice plays and the
// beat's ring sprouts (one of SPROUTS, picked at random for each video), then the beat plays
// with the wedge going round and each hit bursting as it's heard, then an
// end card with the project's link. Two shapes: square (540 units across,
// for 1080 × 1080) for feeds, tall (405 × 720 units, for 1080 × 1920) for
// Stories, Reels and TikTok, with the words kept clear of where those apps
// put their own buttons and captions.
import type { VideoScript } from './script';

/**
 * How the ring sprouts:
 * - drop: the hub listens (pulses with the voice); every beam bursts out on the beat's first step
 * - slices: each slice lifts off the voice as it's heard, flies into the hub, and its ring shoots out
 * - sweep: the hub listens; in the pause before the beat a clock hand sweeps round, beams
 *   sprouting behind it, and the beat starts as it comes back to the top
 */
export const SPROUTS = ['drop', 'slices', 'sweep'] as const;
export type Sprout = (typeof SPROUTS)[number];
export const SPROUT_NAMES: Record<Sprout, string> = {
  drop: 'Drop',
  slices: 'Slice by slice',
  sweep: 'Sweep',
};

/** A sprout for a new video. */
export function pickSprout(random = Math.random): Sprout {
  return SPROUTS[Math.floor(random() * SPROUTS.length) % SPROUTS.length];
}

export const SHAPES = ['square', 'tall'] as const;
export type Shape = (typeof SHAPES)[number];
/** the video's size in pixels */
export const VIDEO_SIZE: Record<Shape, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  tall: { width: 1080, height: 1920 },
};

interface Layout {
  w: number;
  h: number;
  /** the ring's centre and scale (its outer edge is 100·k from the centre) */
  cx: number;
  cy: number;
  k: number;
  /** the name and link: in the corners, or centred along the top */
  head: 'corners' | 'top';
  /** what's playing (the voice's waveform, then the bars): its label's baseline, the waveform's middle */
  meterAlign: 'left' | 'center';
  meterX: number;
  labelY: number;
  waveY: number;
  /** the end card: how far up the ring moves, how small it gets, the BEATVOX line's baseline */
  endUp: number;
  endScale: number;
  endY: number;
  endWidth: number;
}

const LAYOUTS: Record<Shape, Layout> = {
  square: { w: 540, h: 540, cx: 270, cy: 272, k: 2.05, head: 'corners', meterAlign: 'left', meterX: 22, labelY: 480, waveY: 506, endUp: 122, endScale: 0.42, endY: 312, endWidth: 480 },
  // the apps cover about the top 70 and bottom 150 units, and a strip down the right
  tall: { w: 405, h: 720, cx: 202.5, cy: 372, k: 1.45, head: 'top', meterAlign: 'center', meterX: 202.5, labelY: 536, waveY: 556, endUp: 142, endScale: 0.5, endY: 372, endWidth: 360 },
};

const WAVE_W = 172;
const R = 100;
const R0 = 30;
const BAND = (R - R0) / 8;
const HUB = 21;
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
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const FONT = "'Courier Prime', 'Courier New', monospace";
const DEG = Math.PI / 180;

const cl = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
function eob(x: number) {
  x = cl(x);
  const c1 = 2.2;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}
const eoc = (x: number) => 1 - (1 - cl(x)) ** 3;

/** Loudness of the voice at t (0..1). */
function envAt(sc: VideoScript, t: number) {
  if (t < 0 || t > sc.voiceEnd) return 0;
  return sc.env[Math.min(sc.env.length - 1, Math.floor(t * sc.envRate))] ?? 0;
}

function square(g: Ctx, x: number, y: number, rot: number, size: number, fill: string, stroke: string, lw: number, alpha: number) {
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.rotate(rot * DEG);
  g.beginPath();
  g.roundRect(-size / 2, -size / 2, size, size, size * 0.16);
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = stroke;
  g.stroke();
  g.restore();
}

function shadowText(g: Ctx, text: string, x: number, y: number, off: number) {
  const ink = g.fillStyle;
  g.fillStyle = C.pink;
  g.fillText(text, x + off, y + off);
  g.fillStyle = ink;
  g.fillText(text, x, y);
}

/** `text` in at most `lines` lines no wider than `width`, the last cut with … */
function wrap(g: Ctx, text: string, width: number, lines: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width <= width || !line) line = next;
    else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  if (out.length <= lines) return out;
  const kept = out.slice(0, lines);
  let last = kept[lines - 1];
  while (last.length > 1 && g.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  kept[lines - 1] = `${last}…`;
  return kept;
}

/** Draw the video at time t (seconds on the soundtrack). */
export function drawFrame(g: Ctx, sc: VideoScript, sprout: Sprout, t: number, shape: Shape = 'square') {
  const L = LAYOUTS[shape];
  const { cx: CX, cy: CY, k: K } = L;
  const SQ = BAND * 0.8 * K;
  // where the waveform starts (it's WAVE_W wide)
  const wx = L.meterAlign === 'left' ? L.meterX : L.meterX - WAVE_W / 2;
  const scale = g.canvas.width / L.w;
  g.save();
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.fillStyle = C.paper;
  g.fillRect(0, 0, L.w, L.h);

  const { voiceStart: VS, voiceEnd: VE, beatAt: TB, step: STEP, end: TE } = sc;
  const en = envAt(sc, t);
  // the end card: the ring shrinks up out of the way
  const e = eoc((t - TE) / 0.7);
  const gs = 1 - (1 - L.endScale) * e;
  const ecy = CY - L.endUp * e;
  const place = (x: number, y: number): [number, number] => [CX + (x - CX) * gs, ecy + (y - CY) * gs];
  const beatOn = t >= TB;
  const abs = beatOn ? Math.floor((t - TB) / STEP) : -1;
  // after the last bar the end card keeps the last bar going round
  const cur = abs < 0 ? -1 : abs < sc.steps ? abs : sc.steps - 16 + (abs % 16);
  const stepIn = cur >= 0 ? cur % 16 : -1;
  const f = beatOn ? ((t - TB) % STEP) / STEP : 0;
  const bar = cur < 0 ? 0 : Math.floor(cur / 16);
  const hit = (row: number, k: number) => sc.hits[bar * 16 + k]?.[row] ?? false;

  // the wedge (the playhead)
  if (beatOn) {
    const [x, y] = place(CX, CY);
    const a0 = ((stepIn - 0.5) / 16) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((stepIn + 0.5) / 16) * 2 * Math.PI - Math.PI / 2;
    g.globalAlpha = cl((t - TB) / 0.15);
    g.beginPath();
    g.arc(x, y, R * K * gs, a0, a1);
    g.arc(x, y, (R0 - 2) * K * gs, a1, a0, true);
    g.closePath();
    g.fillStyle = 'rgba(255,210,63,0.5)';
    g.fill();
    g.globalAlpha = 1;
  }

  // the clock hand (sweep): round once in the pause between the voice and the beat
  const sweepEnd = TB - 0.08;
  if (sprout === 'sweep' && t > VE && t < TB + 0.1) {
    const h = 360 * cl((t - VE) / (sweepEnd - VE)) * DEG;
    const L = R * K;
    g.globalAlpha = 1 - cl((t - TB + 0.1) / 0.2);
    g.strokeStyle = C.ink;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(CX, CY);
    g.lineTo(CX + L * Math.sin(h), CY - L * Math.cos(h));
    g.stroke();
    g.beginPath();
    g.arc(CX + (L + 4) * Math.sin(h), CY - (L + 4) * Math.cos(h), 6, 0, Math.PI * 2);
    g.fillStyle = C.pink;
    g.fill();
    g.lineWidth = 2;
    g.stroke();
    g.globalAlpha = 1;
  }

  // the squares
  for (let i = 0; i < 8; i++) {
    const row = sc.rows[i];
    const rad = R - BAND * (i + 0.5);
    const heard = row.heardAt ?? TB - 0.3;
    for (let k = 0; k < 16; k++) {
      const a = k * 22.5;
      const on = hit(i, k);
      let r = rad;
      let s = 1;
      let o = 1;
      let da = 0;
      let faint = false;
      if (sprout === 'drop') {
        const u = (t - (TB - 0.12) - (7 - i) * 0.03) / 0.75;
        r = HUB + (rad - HUB) * eob(u);
        s = cl(u * 4);
        da = -60 * (1 - eoc(u));
      } else if (sprout === 'slices') {
        const u = (t - (heard + 0.32) - k * 0.012) / 0.5;
        if (u <= 0) {
          faint = true;
          o = 0.3 * cl((t - 0.1) / 0.4);
          s = 0.55;
        } else {
          r = HUB + (rad - HUB) * eob(u);
          s = cl(u * 5);
        }
      } else if (sprout === 'sweep') {
        const tk = VE + (a / 360) * (sweepEnd - VE);
        const u = (t - tk - (7 - i) * 0.015) / 0.3;
        r = HUB + (rad - HUB) * eob(u);
        s = cl(u * 4);
      }
      if (s <= 0.001 || o <= 0.001) continue;
      const ang = (a + da) * DEG;
      const x = CX + r * K * Math.sin(ang);
      const y = CY - r * K * Math.cos(ang);
      const rot = a + da;
      const burst = beatOn && on && k === stepIn;
      if (burst) s *= 1 + 0.45 * (1 - f) ** 2;
      const [px, py] = place(x, y);
      const lit = on && !faint;
      square(
        g,
        px,
        py,
        rot,
        SQ * s * gs,
        lit ? (FILL[row.sound ?? ''] ?? C.ink) : k % 4 === 0 ? C.paper : C.card,
        lit ? C.ink : C.soft,
        lit ? (burst ? 3.5 : 1.8) : 1.2,
        o,
      );
    }
  }

  // the slices flying from the voice into the hub (slices)
  if (sprout === 'slices') {
    sc.rows.forEach((row) => {
      if (row.heardAt === null) return;
      const w = (t - row.heardAt) / 0.32;
      if (w < 0 || w > 1) return;
      const sx = wx + ((row.heardAt - VS) / (VE - VS)) * WAVE_W;
      const sy = L.waveY;
      const ww = eoc(w);
      const fs = 16 * (1 - 0.4 * w);
      square(g, sx + (CX - sx) * ww, sy + (CY - sy) * ww - 70 * Math.sin(Math.PI * w), w * 270, fs, FILL[row.sound ?? ''] ?? C.ink, C.ink, 2, 1);
    });
  }

  // the hub: pops in, listens (pulses with the voice), swells with a heard slice, then the kick
  let hs = eob((t - 0.05) / 0.4);
  if (!beatOn) hs *= 1 + (sprout === 'slices' ? 0.08 : 0.35) * en;
  if (sprout === 'slices')
    for (const row of sc.rows) {
      if (row.heardAt === null) continue;
      const d = t - row.heardAt - 0.32;
      if (d > 0 && d < 0.25) hs *= 1 + 0.15 * (1 - d / 0.25);
    }
  if (beatOn && sc.rows.some((row, i) => row.sound === 'kick' && hit(i, stepIn))) hs *= 1 + 0.1 * (1 - f) ** 2;
  if (hs > 0.001) {
    const [x, y] = place(CX, CY);
    const hr = HUB * K * hs * gs;
    g.fillStyle = C.pink;
    g.beginPath();
    g.arc(x + 5 * gs, y + 5 * gs, hr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C.yellow;
    g.strokeStyle = C.ink;
    g.lineWidth = 4 * gs;
    g.beginPath();
    g.arc(x, y, hr - 2 * gs, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // the words: the name and link (corners or top), and what's playing
  const head = 1 - e;
  const vo = 1 - cl((t - TB) / 0.3);
  const bo = cl((t - TB) / 0.3) * (1 - e);
  g.textBaseline = 'alphabetic';
  if (head > 0) {
    g.globalAlpha = head;
    g.fillStyle = C.ink;
    if (L.head === 'corners') {
      g.font = `700 30px ${FONT}`;
      shadowText(g, 'BEATVOX', 22, 46, 3);
      g.font = `700 19px ${FONT}`;
      wrap(g, sc.title, 200, 2).forEach((line, i) => g.fillText(line, 22, 74 + i * 22));
      g.textAlign = 'right';
      g.font = `400 11px ${FONT}`;
      g.fillStyle = C.muted;
      g.fillText('make your own', L.w - 20, L.h - 36);
      g.font = `700 13px ${FONT}`;
      g.fillStyle = C.ink;
      g.fillText(sc.link, L.w - 20, L.h - 20);
    } else {
      g.textAlign = 'center';
      g.font = `700 40px ${FONT}`;
      shadowText(g, 'BEATVOX', L.cx, 128, 3);
      g.font = `700 24px ${FONT}`;
      wrap(g, sc.title, L.w - 60, 1).forEach((line) => g.fillText(line, L.cx, 162));
      // "make your own · <link>", centred as one line
      g.textAlign = 'left';
      const pre = 'make your own · ';
      g.font = `400 13px ${FONT}`;
      const pw = g.measureText(pre).width;
      g.font = `700 13px ${FONT}`;
      const lw = g.measureText(sc.link).width;
      const x0 = L.cx - (pw + lw) / 2;
      g.fillText(sc.link, x0 + pw, 186);
      g.font = `400 13px ${FONT}`;
      g.fillStyle = C.muted;
      g.fillText(pre, x0, 186);
    }
    g.textAlign = 'left';
  }
  g.font = `700 11px ${FONT}`;
  g.fillStyle = C.ink;
  g.textAlign = L.meterAlign;
  if (vo > 0) {
    g.globalAlpha = vo;
    g.fillText('THE VOICE', L.meterX, L.labelY);
    for (let b = 0; b < 64; b++) {
      const tb = VS + (b / 64) * (VE - VS);
      const h = 3 + envAt(sc, tb) * 28;
      g.fillStyle = tb <= t ? C.blue : C.soft;
      g.fillRect(wx + b * (WAVE_W / 64), L.waveY - h / 2, 1.8, h);
    }
    if (sprout === 'slices')
      sc.rows.forEach((row) => {
        if (row.heardAt === null) return;
        square(g, wx + ((row.heardAt - VS) / (VE - VS)) * WAVE_W, L.waveY + 23, 0, 6, FILL[row.sound ?? ''] ?? C.ink, C.ink, 1, (t > row.heardAt ? 0.25 : 1) * vo);
      });
  }
  if (bo > 0) {
    g.globalAlpha = bo;
    g.fillStyle = C.ink;
    const bars = sc.steps / 16;
    g.fillText(`THE BEAT · ${bars} BARS`, L.meterX, L.labelY);
    const prog = ((t - TB) / (TE - TB)) * bars;
    const bx0 = L.meterAlign === 'left' ? L.meterX : L.meterX - (bars * 21 - 6) / 2;
    for (let b = 0; b < bars; b++) {
      g.beginPath();
      g.roundRect(bx0 + b * 21, L.waveY - 7, 15, 15, 3);
      g.fillStyle = b < prog ? C.pink : C.card;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = C.ink;
      g.stroke();
    }
  }
  g.textAlign = 'left';

  // the end card
  const eo = cl((t - TE - 0.35) / 0.5);
  if (eo > 0) {
    const Y = L.endY;
    g.globalAlpha = eo;
    g.textAlign = 'center';
    g.fillStyle = C.ink;
    g.font = `700 52px ${FONT}`;
    shadowText(g, 'BEATVOX', CX, Y, 4);
    g.font = `700 24px ${FONT}`;
    wrap(g, sc.title, L.endWidth, 1).forEach((line) => g.fillText(line, CX, Y + 40));
    g.font = `400 15px ${FONT}`;
    g.fillStyle = C.muted;
    g.fillText('a beat made from one voice', CX, Y + 68);
    // the link, in a box
    g.font = `700 20px ${FONT}`;
    const w = Math.max(g.measureText(sc.link).width, 140) + 36;
    const bx = CX - w / 2;
    g.fillStyle = C.blue;
    g.beginPath();
    g.roundRect(bx + 4, Y + 96 + 4, w, 64, 8);
    g.fill();
    g.fillStyle = C.card;
    g.strokeStyle = C.ink;
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(bx, Y + 96, w, 64, 8);
    g.fill();
    g.stroke();
    g.fillStyle = C.muted;
    g.font = `700 12px ${FONT}`;
    g.fillText('MAKE YOUR OWN', CX, Y + 120);
    g.fillStyle = C.ink;
    g.font = `700 20px ${FONT}`;
    g.fillText(sc.link, CX, Y + 146);
    g.textAlign = 'left';
  }
  g.restore();
}
