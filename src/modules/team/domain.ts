/**
 * Team & manager mode (v3.6) — opt-in, AGGREGATED, ANONYMIZED. The default
 * posture stays a personal agent on personal data; this rolls up the counts-only
 * data Tempo already keeps (weekly metrics + per-sender signals) across an opt-in
 * roster into team aggregates — team load, response fairness, focus health.
 *
 * PRIVACY GUARDRAILS (enforced structurally + by tests):
 *  - NEVER any message content (inputs are counts; there is no text to leak).
 *  - NEVER a per-person value or a user id in the output — only aggregates.
 *  - k-ANONYMITY: below `minMembers` opted-in members, the view is REDACTED
 *    (no aggregates at all), so no single person can be inferred from a small
 *    group. So the output is either fully redacted or safely aggregate.
 */

import { analyzeLoad } from "../intelligence/index.js";
import type { SenderSignal, UserMetrics } from "../../ports/store.js";

/** One opted-in member's counts. No user id is passed to the aggregator, so an
 * identity cannot leak into the output even by accident. */
export interface TeamMemberData {
  metrics?: UserMetrics;
  signals: SenderSignal[];
}

export type Distribution = "balanced" | "uneven" | "concentrated";

export interface TeamLoadRedacted {
  redacted: true;
  memberCount: number;
  minMembers: number;
}

export interface TeamLoadAggregate {
  redacted: false;
  memberCount: number;
  /** Team-wide totals. */
  totalObligations: number;
  totalFocusMinutes: number;
  totalMessagesTriaged: number;
  /** Per-person averages (rounded). */
  avgObligations: number;
  avgFocusMinutes: number;
  /** How evenly load is spread across the team — no names, no per-person values. */
  loadDistribution: Distribution;
  /** How evenly obligations (work owed) are shared. */
  responseFairness: Distribution;
}

export type TeamLoadResult = TeamLoadRedacted | TeamLoadAggregate;

export const DEFAULT_MIN_MEMBERS = 3;

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Coefficient of variation → a coarse spread descriptor (never per-person). */
function distribution(xs: number[]): Distribution {
  const m = mean(xs);
  if (m === 0) return "balanced";
  const variance = mean(xs.map((x) => (x - m) ** 2));
  const cov = Math.sqrt(variance) / m;
  if (cov < 0.5) return "balanced";
  if (cov <= 1.0) return "uneven";
  return "concentrated";
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Aggregate an opted-in team's counts into an anonymized view, or redact when
 * the group is too small to anonymize.
 */
export function aggregateTeamLoad(
  members: TeamMemberData[],
  opts: { minMembers?: number } = {},
): TeamLoadResult {
  const minMembers = opts.minMembers ?? DEFAULT_MIN_MEMBERS;
  if (members.length < minMembers) {
    return { redacted: true, memberCount: members.length, minMembers };
  }

  const obligations = members.map((m) => m.metrics?.obligationsSurfaced ?? 0);
  const focus = members.map((m) => m.metrics?.focusMinutesProtected ?? 0);
  const triaged = members.map((m) => m.metrics?.messagesTriaged ?? 0);
  const loadScores = members.map((m) => analyzeLoad(m.metrics, m.signals).score);

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  return {
    redacted: false,
    memberCount: members.length,
    totalObligations: sum(obligations),
    totalFocusMinutes: sum(focus),
    totalMessagesTriaged: sum(triaged),
    avgObligations: round(mean(obligations)),
    avgFocusMinutes: round(mean(focus)),
    loadDistribution: distribution(loadScores),
    responseFairness: distribution(obligations),
  };
}
