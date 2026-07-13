/**
 * TempoContext — the per-user execution context every module shares: the RTS
 * client, the clock, and how far back "since you were last active" reaches.
 *
 * In mock mode the clock is pinned to the seeded narrative (DEMO_NOW) so the
 * demo and tests are deterministic. In live mode it uses the real clock and the
 * user's last-active timestamp (from prefs; defaults to 7 days back).
 */

import { config } from "../config.js";
import type { RtsClient } from "../platform/slack/rts/index.js";
import { CachingRtsClient } from "../platform/slack/rts/caching.js";
import { ScopedRtsClient, isUnscoped, type RtsScope } from "../platform/slack/rts/scoped.js";
import { MultiSourceRtsClient, getExtraSources } from "../platform/sources/index.js";
import type { LlmPort } from "../ports/ai.js";
import type { Store } from "../ports/store.js";
import { createContainer, type Container } from "./container.js";
import { resolveDisplayName } from "../platform/slack/webapi/displayName.js";
import { DEMO_NOW, SAM_LAST_ACTIVE, SUBJECT_USER_ID } from "../platform/slack/rts/fixtures.js";

export interface TempoContext {
  rts: RtsClient;
  /** AI reasoning port, injected so modules never import the AI SDK directly. */
  llm: LlmPort;
  /** The composition container — how the application layer resolves the rest of
   * its outbound adapters (MCP, Slack write-actions) for this turn. */
  container: Container;
  /** The persistence adapter (file or Postgres) for this turn — resolved once
   * from the container so every module reads/writes through the same store. */
  store: Store;
  nowTs: number;
  lastActiveTs: number;
  awayDays: number;
  subjectUserId: string;
  subjectName: string;
  /** Threaded through to Slack-native actions (focus DND/status/digest). */
  userToken?: string;
}

export interface BuildContextOpts {
  userToken?: string;
  subjectUserId?: string;
  subjectName?: string;
  lastActiveTs?: number;
  /** Override the resolved LLM adapter (tests inject a MockLlm). */
  llm?: LlmPort;
  /** Override the composition container (tests inject mock adapters). */
  container?: Container;
  /** The user's consent scope — which channels Tempo may read, who it must
   * ignore. Absent/empty = everywhere, i.e. the behaviour before this existed. */
  scope?: RtsScope;
}

/**
 * The ONE way an entrypoint should build a context for a real Slack user.
 *
 * Bolt, the morning-digest cron and the inbound MCP server each need the same
 * three lookups — the user's stored token, their display name, and their prefs —
 * and each was hand-rolling them. Two of the three forgot the consent scope, so
 * "only watch #eng" held in the Slack app while the cron DM'd the user content
 * from channels they had explicitly de-selected and the MCP server ignored their
 * settings entirely. A consent control that holds on one surface out of three is
 * worse than none: it makes a promise it doesn't keep.
 *
 * So the lookups live here, once. Forgetting the scope now requires bypassing
 * this function, rather than merely not remembering to add a field.
 *
 * `client` is Bolt's WebClient when we have one; otherwise we mint a bot client.
 */
export async function buildUserContext(opts: {
  subjectUserId: string;
  /** Anything with `users.info` — Bolt's client, or a WebClient. */
  client: { users: { info: (a: { user: string }) => Promise<unknown> } };
  container?: Container;
  lastActiveTs?: number;
}): Promise<TempoContext> {
  const store = (opts.container ?? createContainer()).store();
  const [storedToken, prefs, subjectName] = await Promise.all([
    store.tokens.get(opts.subjectUserId),
    store.prefs.get(opts.subjectUserId),
    resolveDisplayName(opts.client as never, opts.subjectUserId),
  ]);

  return buildContext({
    subjectUserId: opts.subjectUserId,
    subjectName,
    userToken: storedToken ?? config.slack.userToken,
    container: opts.container,
    lastActiveTs: opts.lastActiveTs,
    // The consent scope. Absent/empty = watch everywhere.
    scope: { watchedChannels: prefs?.watchedChannels, mutedUsers: prefs?.mutedUsers },
  });
}

export function buildContext(opts: BuildContextOpts = {}): TempoContext {
  const live = config.runtime.rts === "live";
  const nowTs = live ? Math.floor(Date.now() / 1000) : DEMO_NOW;
  const lastActiveTs =
    opts.lastActiveTs ?? (live ? nowTs - 7 * 24 * 3600 : SAM_LAST_ACTIVE);
  const container = opts.container ?? createContainer();
  // Attention OS (v4.0): when extra sources are configured, ground across Slack
  // + them (email/calendar/…) as one working memory; otherwise Slack is the sole
  // source (identical to every prior version).
  const primary = container.rts({ userToken: opts.userToken, subjectUserId: opts.subjectUserId });
  const extras = getExtraSources();
  const multi = extras.length ? new MultiSourceRtsClient(primary, extras) : primary;
  // Consent scope wraps the grounded source, so EVERY module (triage, ledger,
  // decoder, re-entry) inherits it without knowing it exists. Skipped entirely
  // when the user hasn't narrowed anything — no wrapper, no behaviour change.
  const grounded = isUnscoped(opts.scope) ? multi : new ScopedRtsClient(multi, opts.scope!);
  return {
    // Wrap the resolved client in a per-request cache: a single turn often
    // searches RTS for the same thing more than once (module + decode/draft
    // lookups). The cache lives only as long as this context.
    rts: new CachingRtsClient(grounded),
    llm: opts.llm ?? container.llm(),
    container,
    store: container.store(),
    nowTs,
    lastActiveTs,
    awayDays: Math.max(1, Math.round((nowTs - lastActiveTs) / (24 * 3600))),
    subjectUserId: opts.subjectUserId ?? SUBJECT_USER_ID,
    subjectName: opts.subjectName ?? "there",
    userToken: opts.userToken,
  };
}

export const afterTsOf = (ctx: TempoContext) => `${ctx.lastActiveTs}.000000`;
