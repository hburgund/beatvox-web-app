// The small loop clock as an HTML string, for map markers (Leaflet draws
// markers from HTML, not components): 16 squares round a play face, filled
// where any playing row of the beat hits. Same look as MiniClock.svelte.
import type { RingRow } from './shared';

export function clockMarker(rows: RingRow[] | null, opts: { size?: number; face?: string; selected?: boolean } = {}): string {
  const d = opts.size ?? 40;
  const c = d / 2;
  const rad = d / 2 - 4;
  const s = Math.max(3.5, d * 0.13);
  const sq: string[] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * 2 * Math.PI;
    const x = c + rad * Math.sin(a);
    const y = c - rad * Math.cos(a);
    const hit = rows ? rows.some((r) => r.on && r.hits[k]) : false;
    sq.push(
      `<rect x="${(x - s / 2).toFixed(1)}" y="${(y - s / 2).toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" ` +
        `fill="${hit ? '#1d1b16' : '#fffcf4'}" stroke="${hit ? '#1d1b16' : '#cfc7b3'}" stroke-width="1" ` +
        `transform="rotate(${k * 22.5} ${x.toFixed(1)} ${y.toFixed(1)})"/>`,
    );
  }
  const f = d * 0.3;
  const t = d * 0.1;
  const face = opts.face ?? (opts.selected ? '#ff5c80' : '#ffd23f');
  return (
    `<svg width="${d}" height="${d}" viewBox="0 0 ${d} ${d}" aria-hidden="true">${sq.join('')}` +
    `<circle cx="${c}" cy="${c}" r="${f.toFixed(1)}" fill="${face}" stroke="#1d1b16" stroke-width="${opts.selected ? 2.4 : 1.8}"/>` +
    `<path d="M${(c - t * 0.7).toFixed(1)} ${(c - t).toFixed(1)} L${(c + t).toFixed(1)} ${c} L${(c - t * 0.7).toFixed(1)} ${(c + t).toFixed(1)} Z" fill="#1d1b16"/></svg>`
  );
}
