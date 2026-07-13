/**
 * Consent scoping — the user decides where Tempo is allowed to look.
 *
 * Tempo already reads only what *you* can see (RTS runs on your own token). This
 * narrows it further: only the channels you picked, and never the people you
 * muted. "Reads only what you can see" becomes "and only where you allow."
 *
 * Implemented as an `RtsClient` decorator — the same shape as `CachingRtsClient`
 * — so it slots into `buildContext` once and Triage, the Commitment Ledger, the
 * Tone Decoder and Re-entry all inherit it without a line of change in any of
 * them. That is the ports/adapters dependency rule paying rent.
 *
 * Why filter here and not in the query: `assistant.search.context` has no
 * channel-id parameter (see `RtsSearchParams`) — only `channelTypes`. So the
 * narrowing is applied to the returned messages. Filtering post-hoc is also the
 * safer default: an RTS change can never silently widen the user's scope.
 *
 * DEFAULT-OPEN, DELIBERATELY: an empty/absent `watchedChannels` means "watch
 * everywhere", which is byte-identical to Tempo's behaviour before this existed.
 * An allowlist that defaulted to *closed* would silently show every existing
 * user an empty triage.
 */

import type {
  RtsClient,
  RtsSearchParams,
  RtsSearchResult,
} from "../../../ports/rts.js";

export interface RtsScope {
  /** Channel ids Tempo may read. Empty/absent = every channel the user can see. */
  watchedChannels?: string[];
  /** Author ids Tempo must ignore, wherever they post. */
  mutedUsers?: string[];
}

/** True when the scope would change nothing — lets callers skip the wrapper. */
export function isUnscoped(scope: RtsScope | undefined): boolean {
  return !scope?.watchedChannels?.length && !scope?.mutedUsers?.length;
}

export class ScopedRtsClient implements RtsClient {
  readonly subjectUserId: string;
  private readonly inner: RtsClient;
  private readonly watched?: Set<string>;
  private readonly muted: Set<string>;

  constructor(inner: RtsClient, scope: RtsScope) {
    this.inner = inner;
    this.subjectUserId = inner.subjectUserId;
    // Absent OR empty both mean "no allowlist" — see the default-open note above.
    this.watched = scope.watchedChannels?.length
      ? new Set(scope.watchedChannels)
      : undefined;
    this.muted = new Set(scope.mutedUsers ?? []);
  }

  async search(params: RtsSearchParams): Promise<RtsSearchResult> {
    const res = await this.inner.search(params);

    const messages = res.messages.filter((m) => {
      // A muted person is muted everywhere, in every source.
      if (this.muted.has(m.authorId)) return false;
      if (this.watched === undefined) return true;
      // The channel allowlist is about SLACK CHANNELS. Attention-OS sources
      // (email, calendar) carry synthetic ids ("EMAIL", "CAL") that can never be
      // in a Slack channel picker — so applying the allowlist to them would have
      // silently deleted 100% of a user's email and calendar the moment they
      // picked any channel, with no error and no hint. The two features would
      // have been quietly mutually exclusive.
      if (m.source && m.source !== "slack") return true;
      return this.watched.has(m.channelId);
    });

    // A muted author must not reach the prompt through the roster either — the
    // LLM is handed `users` alongside the messages.
    const users = res.users.filter((u) => !this.muted.has(u.id));

    // `returned` must reflect what Tempo actually reasoned over, not what Slack
    // handed back — the metrics and the "I scanned N messages" line read it.
    return { ...res, messages, users, meta: { ...res.meta, returned: messages.length } };
  }
}
