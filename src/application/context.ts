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
import { MultiSourceRtsClient, getExtraSources } from "../platform/sources/index.js";
import type { LlmPort } from "../ports/ai.js";
import type { Store } from "../ports/store.js";
import { createContainer, type Container } from "./container.js";
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
  const grounded = extras.length ? new MultiSourceRtsClient(primary, extras) : primary;
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
