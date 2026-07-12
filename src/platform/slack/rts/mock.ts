/**
 * Mock RTS adapter — backed by the seeded Northwind fixtures.
 *
 * Implements the same `RtsClient` surface as the live adapter so every module,
 * test, and the demo run identically with `TEMPO_RTS=mock`. Search is a small
 * keyword + light-semantic scorer with recency fallback — enough to make triage
 * decisions non-trivial without a live workspace.
 */

import {
  CHANNELS,
  DEMO_NOW,
  MESSAGES,
  SUBJECT_USER_ID,
  USERS,
  type Channel,
} from "./fixtures.js";
import type {
  RtsClient,
  RtsMessage,
  RtsSearchParams,
  RtsSearchResult,
  RtsUser,
} from "../../../ports/rts.js";

const TEAM_DOMAIN = "northwind";

// Light synonym expansion so a query like "blocked on me" matches "waiting on".
const SYNONYMS: Record<string, string[]> = {
  blocked: ["blocked", "waiting", "stuck", "parked", "blocker", "depends"],
  waiting: ["waiting", "blocked", "pending", "awaiting"],
  promise: ["promise", "i'll", "on me", "on it", "by friday", "by eod", "will send", "get you"],
  decision: ["decision", "decided", "we're moving", "going with", "final"],
  urgent: ["urgent", "eod", "asap", "today", "board", "deadline"],
};

function tsFor(minsAgo: number): string {
  const secs = DEMO_NOW - minsAgo * 60;
  return `${secs}.000100`;
}

function channelById(id: string): Channel | undefined {
  return CHANNELS.find((c) => c.id === id);
}

function userById(id: string): RtsUser | undefined {
  return USERS.find((u) => u.id === id);
}

function permalink(channelId: string, ts: string): string {
  return `https://${TEAM_DOMAIN}.slack.com/archives/${channelId}/p${ts.replace(".", "")}`;
}

/** Build the normalised message list once. */
const ALL_MESSAGES: RtsMessage[] = MESSAGES.map((m) => {
  const ch = channelById(m.channelId);
  const author = userById(m.authorId);
  const ts = tsFor(m.minsAgo);
  return {
    permalink: permalink(m.channelId, ts),
    channelId: m.channelId,
    channelName: ch?.name,
    channelType: ch?.type ?? "public_channel",
    authorId: m.authorId,
    authorName: author?.name,
    authorRealName: author?.realName,
    text: m.text,
    ts,
    mentionsMe: m.mentionsMe ?? m.text.toLowerCase().includes("sam"),
  } satisfies RtsMessage;
});

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function expandQuery(tokens: string[]): Set<string> {
  const out = new Set<string>(tokens);
  for (const t of tokens) {
    for (const [, syns] of Object.entries(SYNONYMS)) {
      if (syns.some((s) => s.includes(t) || t.includes(s.split(" ")[0]!))) {
        syns.forEach((s) => out.add(s.split(" ")[0]!));
      }
    }
  }
  return out;
}

function score(message: RtsMessage, queryTokens: Set<string>): number {
  const text = message.text.toLowerCase();
  let s = 0;
  for (const t of queryTokens) {
    if (t.length < 2) continue;
    if (text.includes(t)) s += 2;
  }
  if (message.mentionsMe) s += 1;
  return s;
}

export class MockRtsClient implements RtsClient {
  readonly subjectUserId = SUBJECT_USER_ID;

  async search(params: RtsSearchParams): Promise<RtsSearchResult> {
    const { query, channelTypes, after, before, limit = 20 } = params;
    const qTokens = expandQuery(tokenize(query));
    // CORPUS_QUERY ("") means "everything I can see in this window" — no lexical
    // filter at all. Mirror the live adapter exactly: scoring an empty query
    // would leave only the mentionsMe messages, which silently drops the hero
    // case (the implicit blocker where nobody @-mentioned you).
    const isCorpus = query.trim() === "";

    let candidates = ALL_MESSAGES.slice();

    if (channelTypes?.length) {
      candidates = candidates.filter((m) => channelTypes.includes(m.channelType));
    }
    if (after) {
      const a = Number(after.split(".")[0]);
      candidates = candidates.filter((m) => Number(m.ts.split(".")[0]) > a);
    }
    if (before) {
      const b = Number(before.split(".")[0]);
      candidates = candidates.filter((m) => Number(m.ts.split(".")[0]) < b);
    }

    const byRecency = (a: RtsMessage, b: RtsMessage) =>
      Number(b.ts.split(".")[0]) - Number(a.ts.split(".")[0]);

    let messages: RtsMessage[];
    if (isCorpus) {
      messages = candidates.sort(byRecency).slice(0, limit);
    } else {
      const scored = candidates
        .map((m) => ({ m, sc: score(m, qTokens) }))
        .sort((a, b) => {
          // Prefer relevance, then recency.
          if (b.sc !== a.sc) return b.sc - a.sc;
          return byRecency(a.m, b.m);
        });

      // If nothing scored (generic "what's new" sweep), fall back to recency.
      const anyHit = scored.some((x) => x.sc > 0);
      const ordered = anyHit ? scored.filter((x) => x.sc > 0) : scored;
      messages = ordered.slice(0, limit).map((x) => x.m);
    }

    return {
      messages,
      users: USERS,
      meta: { source: "mock", query, returned: messages.length },
    };
  }
}
