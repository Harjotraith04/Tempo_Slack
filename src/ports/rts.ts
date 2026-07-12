/**
 * Normalised types for the Slack Real-Time Search (RTS) API.
 *
 * Tempo consumes RTS through this small, stable surface so every module is
 * decoupled from the raw `assistant.search.context` response shape — and so the
 * live adapter can be swapped for the seeded mock with zero changes upstream.
 *
 * COMPLIANCE: data returned here is grounded into the model in-memory and then
 * discarded. Tempo never persists RTS content. See README "Privacy".
 */

export type ChannelType =
  | "public_channel"
  | "private_channel"
  | "mpim"
  | "im";

export type ContentType = "messages" | "files" | "channels" | "users";

/**
 * The corpus query — "everything I'm allowed to see in this time window".
 *
 * Verified against live `assistant.search.context` (Jul 2026): retrieval is
 * LEXICAL and AND-scoped, not intent-based. A natural-language prompt like
 * "questions, requests, or decisions that mention me" matches zero messages,
 * because it ANDs every term; each extra word narrows the result further. An
 * EMPTY query applies no lexical filter and returns the full set of messages
 * the user can see within `after`/`before` — which is exactly what Tempo wants.
 *
 * So we let RTS do the thing only RTS can do — permission-aware retrieval of
 * the user's own accessible history — and let the LLM do the classification.
 * That split is the architecture: RTS grounds, the model reasons. Passing a
 * hand-written keyword list here would silently drop the messages that matter
 * (the implicit blocker nobody @-mentioned you in is exactly the one that has
 * none of your keywords in it).
 */
export const CORPUS_QUERY = "";

export interface RtsSearchParams {
  /** Lexical query, AND-scoped. Use `CORPUS_QUERY` ("") for the full window. */
  query: string;
  contentTypes?: ContentType[];
  channelTypes?: ChannelType[];
  /** Slack ts (seconds.micro) lower bound — only messages strictly after. */
  after?: string;
  /** Slack ts upper bound — only messages strictly before. */
  before?: string;
  limit?: number;
}

export interface RtsMessage {
  permalink: string;
  channelId: string;
  channelName?: string;
  channelType: ChannelType;
  /** Which source this came from — "slack" (default) or, in Attention-OS mode,
   * another work tool (email / calendar / docs / tickets) grounded via MCP. */
  source?: string;
  authorId: string;
  authorName?: string;
  authorRealName?: string;
  text: string;
  /** Slack ts of the message. */
  ts: string;
  threadTs?: string;
  /** True when the searching user is explicitly @-mentioned. */
  mentionsMe?: boolean;
  /** A few surrounding messages RTS returns for context. */
  context?: Pick<RtsMessage, "authorName" | "text" | "ts">[];
}

export interface RtsUser {
  id: string;
  name?: string;
  realName?: string;
  title?: string;
  email?: string;
  tz?: string;
}

export interface RtsSearchResult {
  messages: RtsMessage[];
  users: RtsUser[];
  /** Echoes how the search was run, useful for debugging/telemetry. */
  meta: {
    source: "live" | "mock";
    query: string;
    returned: number;
  };
}

export interface RtsClient {
  /**
   * The searching user (Tempo always acts as one specific person). Used by the
   * mock to compute mentions/authorship; informational for the live adapter.
   */
  readonly subjectUserId: string;
  search(params: RtsSearchParams): Promise<RtsSearchResult>;
}
