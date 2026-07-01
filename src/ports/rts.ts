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

export interface RtsSearchParams {
  /** Natural-language query. RTS runs semantic search on questions. */
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
