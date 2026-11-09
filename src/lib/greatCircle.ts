// The shortest route over the earth between two places, as points to draw.
// A map line between just two points is straight on the flat (Mercator) map,
// which on the globe is a rhumb line that bends away from the shortest path;
// these points follow the great circle instead, like a flight route.

type LngLat = [number, number];

const RAD = Math.PI / 180;

/**
 * `n` segments along the great circle from `a` to `b` ([lng, lat] degrees).
 * Longitudes run on without jumping at the date line (they may go past
 * ±180), so the line crosses the Pacific the short way.
 */
export function greatCircle(a: LngLat, b: LngLat, n = 64): LngLat[] {
  const toVec = ([lng, lat]: LngLat) => [Math.cos(lat * RAD) * Math.cos(lng * RAD), Math.cos(lat * RAD) * Math.sin(lng * RAD), Math.sin(lat * RAD)];
  const va = toVec(a);
  const vb = toVec(b);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const angle = Math.acos(dot);
  // the same place, or (nearly) opposite sides of the earth, where any route is as short
  if (angle < 1e-6 || Math.PI - angle < 1e-6) return [a, b];
  const s = Math.sin(angle);
  const out: LngLat[] = [];
  let prevLng = a[0];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ka = Math.sin((1 - t) * angle) / s;
    const kb = Math.sin(t * angle) / s;
    const x = ka * va[0] + kb * vb[0];
    const y = ka * va[1] + kb * vb[1];
    const z = ka * va[2] + kb * vb[2];
    const lat = Math.atan2(z, Math.hypot(x, y)) / RAD;
    let lng = Math.atan2(y, x) / RAD;
    // keep going the same way round, rather than jumping 360° at the date line
    while (lng - prevLng > 180) lng -= 360;
    while (lng - prevLng < -180) lng += 360;
    prevLng = lng;
    out.push([lng, lat]);
  }
  // land exactly on the end points (b may now be shown 360° along)
  out[0] = a;
  out[n] = [out[n][0], b[1]];
  return out;
}
