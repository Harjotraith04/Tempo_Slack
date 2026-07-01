/**
 * Live RTS adapter — calls Slack's `assistant.search.context`.
 *
 * Uses a USER token, which (per Slack docs) does NOT require an `action_token`,
 * so Tempo can run proactive/scheduled triage scoped to exactly what the user
 * can already see. Bot tokens would need an action_token captured from a
 * message/app_mention event; we avoid that entirely.
 *
 * The response field mapping is defensive: Slack's payload nests results under
 * `results` with messages/users; we normalise what's present and ignore the
 * rest. Verify field names against a live call when RTS access is enabled
 * (see README "Enabling live RTS"). Until then, run with TEMPO_RTS=mock.
 *
 * COMPLIANCE: nothing returned here is persisted.
 */

import { WebClient } from "@slack/web-api";
import { webClientOptions } from "../shared/webClientOptions.js";
import type {
  ChannelType,
  RtsClient,
  RtsMessage,
  RtsSearchParams,
  RtsSearchResult,
  RtsUser,
} from "./types.js";

interface LiveOpts {
  userToken: string;
  subjectUserId: string;
}

/** Cap on cursor-following so a broad query can never fan out unbounded. */
const MAX_PAGES = 5;

export class LiveRtsClient implements RtsClient {
  readonly subjectUserId: string;
  private readonly web: WebClient;

  constructor(opts: LiveOpts) {
    this.subjectUserId = opts.subjectUserId;
    // Shared retry/backoff config so proactive triage survives rate limits.
    this.web = new WebClient(opts.userToken, webClientOptions);
  }

  async search(params: RtsSearchParams): Promise<RtsSearchResult> {
    const limit = params.limit ?? 20;
    const base: Record<string, unknown> = {
      query: params.query,
      content_types: (params.contentTypes ?? ["messages"]).join(","),
      limit,
    };
    if (params.channelTypes?.length) base.channel_types = params.channelTypes.join(",");
    if (params.after) base.after = params.after;
    if (params.before) base.before = params.before;

    // Follow `next_cursor` until we have enough or run out of pages. Defensive:
    // if RTS doesn't paginate this method, there's simply no cursor and we stop
    // after one page — same behaviour as before.
    const messages: RtsMessage[] = [];
    const users: RtsUser[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const args = cursor ? { ...base, cursor } : base;
      // WebClient has no typed method for this yet — call it generically.
      const res = (await this.web.apiCall("assistant.search.context", args)) as RtsRaw;
      messages.push(...normaliseMessages(res, this.subjectUserId));
      users.push(...normaliseUsers(res));
      cursor = res.response_metadata?.next_cursor?.trim() || undefined;
      if (!cursor || messages.length >= limit) break;
    }

    const capped = messages.slice(0, limit);
    return {
      messages: capped,
      users: dedupeUsers(users),
      meta: { source: "live", query: params.query, returned: capped.length },
    };
  }
}

function dedupeUsers(users: RtsUser[]): RtsUser[] {
  const byId = new Map<string, RtsUser>();
  for (const u of users) if (u.id && !byId.has(u.id)) byId.set(u.id, u);
  return [...byId.values()];
}

// ── Defensive normalisation ──────────────────────────────────────────────────

interface RtsRaw {
  ok?: boolean;
  error?: string;
  results?: {
    messages?: RawMessage[];
    users?: RawUser[];
  };
  messages?: RawMessage[];
  users?: RawUser[];
  response_metadata?: { next_cursor?: string };
}

interface RawMessage {
  text?: string;
  ts?: string;
  thread_ts?: string;
  permalink?: string;
  channel?: { id?: string; name?: string; is_private?: boolean; is_im?: boolean; is_mpim?: boolean } | string;
  channel_id?: string;
  channel_name?: string;
  user?: string;
  username?: string;
  author?: { id?: string; name?: string; real_name?: string };
}

interface RawUser {
  id?: string;
  name?: string;
  real_name?: string;
  profile?: { title?: string; email?: string; real_name?: string };
  tz?: string;
}

function rawChannelType(m: RawMessage): ChannelType {
  const ch = typeof m.channel === "object" ? m.channel : undefined;
  if (ch?.is_im) return "im";
  if (ch?.is_mpim) return "mpim";
  if (ch?.is_private) return "private_channel";
  return "public_channel";
}

function normaliseMessages(res: RtsRaw, me: string): RtsMessage[] {
  const raw = res.results?.messages ?? res.messages ?? [];
  return raw.map((m): RtsMessage => {
    const ch = typeof m.channel === "object" ? m.channel : undefined;
    const channelId = ch?.id ?? (typeof m.channel === "string" ? m.channel : m.channel_id) ?? "";
    const text = m.text ?? "";
    return {
      permalink: m.permalink ?? "",
      channelId,
      channelName: ch?.name ?? m.channel_name,
      channelType: rawChannelType(m),
      authorId: m.author?.id ?? m.user ?? "",
      authorName: m.author?.name ?? m.username,
      authorRealName: m.author?.real_name,
      text,
      ts: m.ts ?? "",
      threadTs: m.thread_ts,
      mentionsMe: text.includes(`<@${me}>`),
    };
  });
}

function normaliseUsers(res: RtsRaw): RtsUser[] {
  const raw = res.results?.users ?? res.users ?? [];
  return raw.map((u): RtsUser => ({
    id: u.id ?? "",
    name: u.name,
    realName: u.real_name ?? u.profile?.real_name,
    title: u.profile?.title,
    email: u.profile?.email,
    tz: u.tz,
  }));
}
