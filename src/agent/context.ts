/**
 * TempoContext — the per-user execution context every module shares: the RTS
 * client, the clock, and how far back "since you were last active" reaches.
 *
 * In mock mode the clock is pinned to the seeded narrative (DEMO_NOW) so the
 * demo and tests are deterministic. In live mode it uses the real clock and the
 * user's last-active timestamp (from prefs; defaults to 7 days back).
 */

import { config } from "../config.js";
import { getRtsClient, type RtsClient } from "../rts/index.js";
import { DEMO_NOW, SAM_LAST_ACTIVE, SUBJECT_USER_ID } from "../rts/fixtures.js";

export interface TempoContext {
  rts: RtsClient;
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
}

export function buildContext(opts: BuildContextOpts = {}): TempoContext {
  const live = config.runtime.rts === "live";
  const nowTs = live ? Math.floor(Date.now() / 1000) : DEMO_NOW;
  const lastActiveTs =
    opts.lastActiveTs ?? (live ? nowTs - 7 * 24 * 3600 : SAM_LAST_ACTIVE);
  return {
    rts: getRtsClient({ userToken: opts.userToken, subjectUserId: opts.subjectUserId }),
    nowTs,
    lastActiveTs,
    awayDays: Math.max(1, Math.round((nowTs - lastActiveTs) / (24 * 3600))),
    subjectUserId: opts.subjectUserId ?? SUBJECT_USER_ID,
    subjectName: opts.subjectName ?? "there",
    userToken: opts.userToken,
  };
}

export const afterTsOf = (ctx: TempoContext) => `${ctx.lastActiveTs}.000000`;
