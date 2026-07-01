/**
 * Per-request RTS cache. A single Tempo turn often searches RTS more than once
 * for the same thing — e.g. `respond()` runs a module that searches, then
 * `latestAmbiguousMessage`/`sourceTextFor` search again. This decorator memoizes
 * identical `search(params)` calls so we hit Slack once per distinct query.
 *
 * Scope: one instance per TempoContext (see agent/context.ts). It never crosses
 * users and is thrown away when the turn ends, so nothing RTS returns is ever
 * persisted (invariant: never persist RTS content).
 */

import { Memo } from "../shared/cache.js";
import type { RtsClient, RtsSearchParams, RtsSearchResult } from "./types.js";

export class CachingRtsClient implements RtsClient {
  readonly subjectUserId: string;
  private readonly inner: RtsClient;
  private readonly memo = new Memo<Promise<RtsSearchResult>>();

  constructor(inner: RtsClient) {
    this.inner = inner;
    this.subjectUserId = inner.subjectUserId;
  }

  search(params: RtsSearchParams): Promise<RtsSearchResult> {
    return this.memo.getOrCreate(JSON.stringify(params), () => this.inner.search(params));
  }
}
