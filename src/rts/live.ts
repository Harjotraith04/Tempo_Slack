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

export class LiveRtsClient implements RtsClient {
  readonly subjectUserId: string;
  private readonly web: WebClient;

  constructor(opts: LiveOpts) {
    this.subjectUserId = opts.subjectUserId;
    this.web = new WebClient(opts.userToken);
  }

  async search(params: RtsSearchParams): Promise<RtsSearchResult> {
    const args: Record<string, unknown> = {
      query: params.query,
      content_types: (params.contentTypes ?? ["messages"]).join(","),
      limit: params.limit ?? 20,
    };
    if (params.channelTypes?.length) args.channel_types = params.channelTypes.join(",");
    if (params.after) args.after = params.after;
    if (params.before) args.before = params.before;

    // WebClient has no typed method for this yet — call it generically.
    const res = (await this.web.apiCall("assistant.search.context", args)) as RtsRaw;

    const messages = normaliseMessages(res, this.subjectUserId);
    const users = normaliseUsers(res);

    return {
      messages,
      users,
      meta: { source: "live", query: params.query, returned: messages.length },
    };
  }
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
