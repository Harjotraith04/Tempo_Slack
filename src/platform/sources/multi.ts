/**
 * Attention OS (v4.0) — the working-memory layer across work tools.
 *
 * `MultiSourceRtsClient` implements the SAME `RtsClient` port the domain already
 * depends on, but fans a search out across a PRIMARY source (Slack RTS) plus any
 * extra sources (email / calendar / docs / tickets, grounded via MCP), tags each
 * result with its origin, and merges them into one calm list. Because it's just
 * another `RtsClient`, triage / commitments / re-entry ground across every source
 * with zero change — Slack is simply the default when no extras are configured.
 *
 * COMPLIANCE unchanged: results are grounded in-memory and discarded; the same
 * never-persist-content invariant holds for every source.
 */

import type { RtsClient, RtsSearchParams, RtsSearchResult, RtsUser } from "../../ports/rts.js";

export interface NamedSource {
  /** Origin tag stamped onto each message (e.g. "email", "calendar"). */
  name: string;
  client: RtsClient;
}

export class MultiSourceRtsClient implements RtsClient {
  readonly subjectUserId: string;

  constructor(
    private readonly primary: RtsClient,
    private readonly extras: NamedSource[],
    private readonly primaryName = "slack",
  ) {
    this.subjectUserId = primary.subjectUserId;
  }

  async search(params: RtsSearchParams): Promise<RtsSearchResult> {
    const results = await Promise.all([
      this.primary.search(params).then((r) => ({ r, name: this.primaryName })),
      ...this.extras.map((s) => s.client.search(params).then((r) => ({ r, name: s.name }))),
    ]);

    const seen = new Set<string>();
    const messages = [];
    const users: RtsUser[] = [];
    let returned = 0;

    for (const { r, name } of results) {
      for (const m of r.messages) {
        const key = `${m.source ?? name}:${m.permalink || `${m.channelId}:${m.ts}`}`;
        if (seen.has(key)) continue;
        seen.add(key);
        messages.push({ ...m, source: m.source ?? name });
      }
      for (const u of r.users) users.push(u);
      returned += r.meta.returned;
    }

    // Primary is first (Promise.all preserves order) — echo its live/mock mode.
    return { messages, users, meta: { source: results[0]!.r.meta.source, query: params.query, returned } };
  }
}
