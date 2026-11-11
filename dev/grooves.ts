// Dev-server-only plugin: pulls candidate style beats out of the Groove MIDI
// Dataset (Google Magenta, CC BY 4.0; real drummers, long live takes) for the
// studio's audition panel, and keeps the ones picked. The dataset and the
// picks live beside the repo in ../sources/, never in it. Never in a build.
//
// For each take, the bars are grouped by their kick and snare; for the one or
// two groups the drummer kept coming back to, a hit stays where it's played in
// at least half of those bars (so passing taps and fills drop out), at its
// typical loudness. Swing comes from how late the off-beat sixteenths land.
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import type { Recipe, RecipeVoice, Role } from '../src/lib/recipe.ts';

const SOURCES = path.resolve(import.meta.dirname, '../../sources');
const GMD = path.join(SOURCES, 'google-groove-midi');
const PICKS = path.join(SOURCES, 'groove-picks.json');

export interface Candidate {
  id: string;
  /** the dataset's style, e.g. "funk/groove2" */
  style: string;
  genre: string;
  drummer: string;
  bpm: number;
  /** bars in the take, and how many of them play this groove */
  bars: number;
  steady: number;
  recipe: Recipe;
}

// the kit's drums (General MIDI, plus the Roland TD-11's edge and rim notes)
type Drum = 'kick' | 'snare' | 'stick' | 'hat' | 'openhat' | 'ride' | 'tom' | 'clap' | 'perc';
const DRUM: Record<number, Drum> = {
  35: 'kick', 36: 'kick',
  38: 'snare', 40: 'snare', 37: 'stick', 39: 'clap',
  42: 'hat', 22: 'hat', 44: 'hat', 46: 'openhat', 26: 'openhat',
  51: 'ride', 59: 'ride', 53: 'ride',
  41: 'tom', 43: 'tom', 45: 'tom', 47: 'tom', 48: 'tom', 50: 'tom', 58: 'tom',
  54: 'perc', 56: 'perc',
};
// the order voices appear in, and the role each one asks for
const VOICE: [Drum, Role][] = [
  ['kick', 'kick'], ['snare', 'snare'], ['hat', 'hat'], ['openhat', 'hat'], ['ride', 'hat'],
  ['stick', 'perc'], ['clap', 'perc'], ['perc', 'perc'], ['tom', 'tonal'],
];
// played in triplets or swung eighths, which a sixteenth grid can't hold
const SKIP = /jazz|blues|shuffle|swing/;

// ── MIDI ─────────────────────────────────────────────────────────────────

interface Note {
  tick: number;
  note: number;
  vel: number;
}

export function readMidi(d: Uint8Array): { div: number; notes: Note[] } {
  const u32 = (i: number) => (d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3];
  const u16 = (i: number) => (d[i] << 8) | d[i + 1];
  if (String.fromCharCode(...d.subarray(0, 4)) !== 'MThd') throw new Error('not a MIDI file');
  const tracks = u16(10);
  const div = u16(12);
  const notes: Note[] = [];
  let i = 8 + u32(4);
  for (let tr = 0; tr < tracks && i < d.length; tr++) {
    const end = i + 8 + u32(i + 4);
    let j = i + 8;
    let tick = 0;
    let status = 0;
    const vlq = () => {
      let v = 0;
      for (;;) {
        const b = d[j++];
        v = (v << 7) | (b & 0x7f);
        if (!(b & 0x80)) return v;
      }
    };
    while (j < end) {
      tick += vlq();
      const b = d[j];
      if (b === 0xff) {
        j += 2;
        j += vlq();
        continue;
      }
      if (b === 0xf0 || b === 0xf7) {
        j++;
        j += vlq();
        continue;
      }
      if (b & 0x80) {
        status = b;
        j++;
      }
      const ev = status & 0xf0;
      const a = d[j];
      const c = ev === 0xc0 || ev === 0xd0 ? 0 : d[j + 1];
      j += ev === 0xc0 || ev === 0xd0 ? 1 : 2;
      if (ev === 0x90 && c > 0) notes.push({ tick, note: a, vel: c });
    }
    i = end;
  }
  return { div, notes };
}

// ── Grooves ──────────────────────────────────────────────────────────────

/** a bar: per drum, step → loudest velocity */
type Bar = Map<Drum, Map<number, number>>;

/**
 * Where the takes' bars really start. A take rarely begins exactly on a
 * downbeat, so: first the grid's fine offset (the typical fraction of a
 * sixteenth every hit is off by), then the whole-step shift that puts kicks
 * on the strong beats and snares on the backbeat.
 */
export function phase(q: number, notes: Note[]): number {
  const hits = notes.filter((n) => DRUM[n.note]);
  // the circular mean of where hits fall within a sixteenth
  let sx = 0;
  let sy = 0;
  for (const n of hits) {
    const a = ((n.tick / q) % 1) * 2 * Math.PI;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  let fine = Math.atan2(sy, sx) / (2 * Math.PI);
  if (fine > 0.5) fine -= 1;
  let best = 0;
  let bestScore = -Infinity;
  for (let shift = 0; shift < 16; shift++) {
    let score = 0;
    for (const n of hits) {
      const k = (((Math.round(n.tick / q - fine) - shift) % 16) + 16) % 16;
      const w = n.vel / 127;
      const drum = DRUM[n.note];
      if (drum === 'kick') score += w * (k === 0 ? 3 : k === 8 ? 1.5 : k % 4 === 0 ? 0.5 : 0);
      else if (drum === 'snare') score += w * (k === 4 || k === 12 ? 3 : 0);
      if (k % 2 === 0) score += 0.2 * w;
    }
    if (score > bestScore) {
      bestScore = score;
      best = shift;
    }
  }
  return fine + best;
}

function bars(div: number, notes: Note[]): { bars: Bar[]; late: number[]; off: number[] } {
  const q = div / 4;
  const shift = phase(q, notes);
  const out: Bar[] = [];
  const late: number[] = [];
  const off: number[] = [];
  for (const n of notes) {
    const drum = DRUM[n.note];
    if (!drum) continue;
    const at = n.tick / q - shift;
    if (at < -0.5) continue;
    const s = Math.round(at);
    const d = at - s;
    off.push(Math.abs(d));
    if (s % 2 === 1) late.push(d);
    const b = Math.floor(s / 16);
    const bar = (out[b] ??= new Map());
    const row = bar.get(drum) ?? new Map<number, number>();
    row.set(s % 16, Math.max(n.vel, row.get(s % 16) ?? 0));
    bar.set(drum, row);
  }
  for (let b = 0; b < out.length; b++) out[b] ??= new Map();
  return { bars: out, late, off };
}

const shape = (bar: Bar) => (['kick', 'snare'] as Drum[]).map((d) => [...(bar.get(d)?.keys() ?? [])].sort((a, b) => a - b).join(',')).join('|');
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** The step pattern every voice plays in `group`, kept where it's played in at least half of the bars. */
function consensus(group: Bar[]): Map<Drum, Map<number, number>> {
  const out = new Map<Drum, Map<number, number>>();
  for (const [drum] of VOICE) {
    const row = new Map<number, number>();
    for (let k = 0; k < 16; k++) {
      const vels = group.map((b) => b.get(drum)?.get(k)).filter((v): v is number => v !== undefined);
      if (vels.length * 2 >= group.length) row.set(k, median(vels));
    }
    if (row.size) out.set(drum, row);
  }
  return out;
}

export function grooves(file: string, meta: { style: string; drummer: string; bpm: number; id: string }): Candidate[] {
  const { div, notes } = readMidi(fs.readFileSync(file));
  const { bars: all, late, off } = bars(div, notes);
  // a take that doesn't sit on the grid (or barely has bars) isn't worth hearing
  if (all.length < 4 || median(off) > 0.25) return [];
  const groups = new Map<string, Bar[]>();
  for (const bar of all) if (bar.get('kick') || bar.get('snare')) groups.set(shape(bar), [...(groups.get(shape(bar)) ?? []), bar]);
  const top = [...groups.values()].filter((g) => g.length >= 3).sort((a, b) => b.length - a.length).slice(0, 2);
  const swing = Math.min(0.4, Math.max(0, Math.round(median(late) * 50) / 50));
  return top.map((group, gi) => {
    const pat = consensus(group);
    const loud = Math.max(...[...pat.values()].map((r) => median([...r.values()])));
    const voices: RecipeVoice[] = [];
    for (const [drum, role] of VOICE) {
      const row = pat.get(drum);
      if (!row || voices.length >= 8) continue;
      let p = '';
      for (let k = 0; k < 16; k++) {
        const v = row.get(k);
        p += v === undefined ? '.' : v >= 100 ? 'X' : v >= 60 ? 'x' : 'o';
      }
      const level = Math.max(0.35, Math.min(1, Math.round((median([...row.values()]) / loud) * 20) / 20));
      voices.push({ pattern: p, role, level });
    }
    const genre = meta.style.split('/')[0];
    return {
      id: `${meta.id}#${gi + 1}`,
      style: meta.style,
      genre,
      drummer: meta.drummer,
      bpm: meta.bpm,
      bars: all.length,
      steady: group.length,
      recipe: {
        format: 'beatvox-recipe',
        version: 1,
        name: `${meta.style.replace('/', ' ')} ${meta.bpm}`,
        kind: 'style',
        bpm: meta.bpm,
        swing: swing >= 0.04 ? swing : 0,
        humanize: 0.4,
        space: 25,
        evolve: { auto: false },
        voices,
      },
    };
  });
}

/** Every candidate in the dataset, best first within each genre; the same groove played twice is kept once. */
export function candidates(root = GMD): Candidate[] {
  const csv = fs.readFileSync(path.join(root, 'info.csv'), 'utf8').trim().split('\n');
  const head = csv[0].split(',');
  const col = (name: string) => head.indexOf(name);
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const line of csv.slice(1)) {
    const c = line.split(',');
    const style = c[col('style')];
    if (c[col('beat_type')] !== 'beat' || c[col('time_signature')] !== '4-4' || SKIP.test(style)) continue;
    const file = path.join(root, c[col('midi_filename')]);
    if (!fs.existsSync(file)) continue;
    for (const g of grooves(file, { style, drummer: c[col('drummer')], bpm: Number(c[col('bpm')]), id: c[col('id')] })) {
      const sig = g.recipe.voices.map((v) => v.pattern.replace(/[Xxo]/g, 'x')).join('|');
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(g);
    }
  }
  // the steadiest first: grooves the drummer held longest
  return out.sort((a, b) => a.genre.localeCompare(b.genre) || b.steady / b.bars - a.steady / a.bars);
}

export function grooveAudition(): Plugin {
  let cache: Candidate[] | null = null;
  return {
    name: 'beatvox-groove-audition',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__grooves', (req, res) => {
        const url = (req.url ?? '/').split('?')[0];
        const json = (x: unknown) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(x));
        };
        try {
          if (url === '/candidates') {
            if (!fs.existsSync(GMD)) return json([]);
            cache ??= candidates();
            return json(cache);
          }
          if (url === '/picks' && req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
              const picks = JSON.parse(body);
              if (!Array.isArray(picks)) throw new Error('picks must be a list');
              fs.writeFileSync(PICKS, JSON.stringify(picks, null, 2) + '\n');
              json({ ok: true, count: picks.length });
            });
            return;
          }
          if (url === '/picks') return json(fs.existsSync(PICKS) ? JSON.parse(fs.readFileSync(PICKS, 'utf8')) : []);
          res.statusCode = 404;
          res.end('not found');
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}
