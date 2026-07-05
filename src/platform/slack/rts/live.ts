/**
 * Live RTS adapter — calls Slack's `assistant.search.context`.
 *
 * Uses a USER token, which (per Slack docs) does NOT require an `action_token`,
 * so Tempo can run proactive/scheduled triage scoped to exactly what the user
 * can already see. Bot tokens would need an action_token captured from a
 * message/app_mention event; we avoid that entirely.
 *
 * Response field mapping follows the published `assistant.search.context`
 * reference (docs.slack.dev/reference/methods/assistant.search.context, RTS GA
 * Feb 2026): results nest under `results.messages` / `results.users`, and each
 * message is FLAT — `content`, `message_ts`, `author_user_id`, `author_name`,
 * `channel_id`, `channel_name` (no nested `channel` object, no channel-type
 * flag). Users are flat too — `user_id`, `full_name`, `title`, `email`,
 * `timezone`. We map those documented fields first and keep the older
 * best-effort fallbacks so any payload variant still degrades gracefully. The
 * one field the API doesn't return is a per-message channel type, so we infer
 * it from the Slack channel-ID prefix (D=DM, G=group/mpim). Still unverified
 * against a real call — `npm run verify:rts` reports per-field coverage so any
 * remaining mismatch is caught before the demo.
 *
 * COMPLIANCE: nothing returned here is persisted.
 */

import { WebClient } from "@slack/web-api";
import { webClientOptions } from "../../../shared/webClientOptions.js";
import type {
  ChannelType,
  RtsClient,
  RtsMessage,
  RtsSearchParams,
  RtsSearchResult,
  RtsUser,
} from "../../../ports/rts.js";

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
    // The API caps `limit` at 20 per request (docs); paginate for more.
    const base: Record<string, unknown> = {
      query: params.query,
      // The reference shows these as JSON arrays, not comma strings.
      content_types: params.contentTypes ?? ["messages"],
      limit: Math.min(20, limit),
    };
    if (params.channelTypes?.length) base.channel_types = params.channelTypes;
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
  // Documented (assistant.search.context) fields — mapped first.
  content?: string;
  message_ts?: string;
  author_user_id?: string;
  author_name?: string;
  channel_id?: string;
  channel_name?: string;
  thread_ts?: string;
  permalink?: string;
  is_author_bot?: boolean;
  // Best-effort fallbacks kept for any payload variant.
  text?: string;
  ts?: string;
  channel?: { id?: string; name?: string; is_private?: boolean; is_im?: boolean; is_mpim?: boolean } | string;
  user?: string;
  username?: string;
  author?: { id?: string; name?: string; real_name?: string };
}

interface RawUser {
  // Documented fields.
  user_id?: string;
  full_name?: string;
  title?: string;
  email?: string;
  timezone?: string;
  // Fallbacks.
  id?: string;
  name?: string;
  real_name?: string;
  profile?: { title?: string; email?: string; real_name?: string };
  tz?: string;
}

/**
 * The RTS response carries no per-message channel-type flag, so infer it from
 * the resolved channel id: Slack ids are prefixed `D`=DM, `G`=group/mpim,
 * `C`=public/private channel. Prefer any nested `channel` object flags when a
 * variant provides them.
 */
function channelTypeOf(m: RawMessage, channelId: string): ChannelType {
  const ch = typeof m.channel === "object" ? m.channel : undefined;
  if (ch?.is_im) return "im";
  if (ch?.is_mpim) return "mpim";
  if (ch?.is_private) return "private_channel";
  if (channelId.startsWith("D")) return "im";
  if (channelId.startsWith("G")) return "mpim";
  return "public_channel";
}

function normaliseMessages(res: RtsRaw, me: string): RtsMessage[] {
  const raw = res.results?.messages ?? res.messages ?? [];
  return raw.map((m): RtsMessage => {
    const ch = typeof m.channel === "object" ? m.channel : undefined;
    const channelId =
      m.channel_id ?? ch?.id ?? (typeof m.channel === "string" ? m.channel : undefined) ?? "";
    const text = m.content ?? m.text ?? "";
    return {
      permalink: m.permalink ?? "",
      channelId,
      channelName: m.channel_name ?? ch?.name,
      channelType: channelTypeOf(m, channelId),
      authorId: m.author_user_id ?? m.author?.id ?? m.user ?? "",
      authorName: m.author_name ?? m.author?.name ?? m.username,
      authorRealName: m.author?.real_name,
      text,
      ts: m.message_ts ?? m.ts ?? "",
      threadTs: m.thread_ts,
      mentionsMe: text.includes(`<@${me}>`),
    };
  });
}

function normaliseUsers(res: RtsRaw): RtsUser[] {
  const raw = res.results?.users ?? res.users ?? [];
  return raw.map((u): RtsUser => ({
    id: u.user_id ?? u.id ?? "",
    name: u.name,
    realName: u.full_name ?? u.real_name ?? u.profile?.real_name,
    title: u.title ?? u.profile?.title,
    email: u.email ?? u.profile?.email,
    tz: u.timezone ?? u.tz,
  }));
}
