// Which BeatVoxes this device has liked or flagged. Roundware can't take a
// vote back or tell the public how anyone voted, so this is how a heart
// stays filled in: one vote of each kind per BeatVox per device.

export type VoteKind = 'like' | 'flag';

const KEY = 'beatvox.votes';

function read(): Record<VoteKind, number[]> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<VoteKind, number[]>>;
    return { like: Array.isArray(v.like) ? v.like : [], flag: Array.isArray(v.flag) ? v.flag : [] };
  } catch {
    return { like: [], flag: [] };
  }
}

export function hasVoted(kind: VoteKind, asset: number): boolean {
  return read()[kind].includes(asset);
}

export function markVoted(kind: VoteKind, asset: number) {
  const v = read();
  if (v[kind].includes(asset)) return;
  v[kind].push(asset);
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* no storage: it's remembered until the page closes */
  }
}
