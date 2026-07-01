/**
 * A tiny in-memory memo. Tempo uses it to dedupe identical RTS searches within
 * a single request (see rts/caching.ts): a fresh instance per TempoContext, so
 * it never crosses users and is discarded when the turn ends.
 *
 * COMPLIANCE: request-scoped and in-memory only — RTS content is never written
 * to disk here (invariant: never persist RTS content).
 */
export class Memo<V> {
  private readonly store = new Map<string, V>();

  /** Returns the cached value for `key`, or computes+stores it via `factory`. */
  getOrCreate(key: string, factory: () => V): V {
    const hit = this.store.get(key);
    if (hit !== undefined) return hit;
    const created = factory();
    this.store.set(key, created);
    return created;
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
