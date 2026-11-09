// Wander's "what next": a shuffle bag. Every mix in the pool plays once, in
// random order, before any plays again; then a new round starts, never with
// the one that just played. If the pool changes (filters, or "this vox"),
// mixes already played this round still count as played.

export class ShuffleBag {
  private played = new Set<number>();

  constructor(private random: () => number = Math.random) {}

  /**
   * The next id from `pool`, not `current`, and not one already played this
   * round while unplayed ones remain. null for an empty pool.
   */
  next(pool: number[], current?: number | null): number | null {
    if (!pool.length) return null;
    let fresh = pool.filter((id) => !this.played.has(id) && id !== current);
    if (!fresh.length) {
      // a new round: everything is fresh again except what's playing now
      this.played.clear();
      fresh = pool.filter((id) => id !== current);
      if (!fresh.length) fresh = pool;
    }
    const id = fresh[Math.floor(this.random() * fresh.length)];
    this.played.add(id);
    return id;
  }

  /** Count `id` as played (it was chosen by hand, or wandering began on it). */
  mark(id: number) {
    this.played.add(id);
  }

  reset() {
    this.played.clear();
  }
}
