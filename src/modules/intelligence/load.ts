/**
 * Overload / burnout early-warning (v3.4) — a pure, deterministic read of how
 * loaded the user is, computed ONLY from the counts Tempo already keeps
 * (privacy-safe weekly metrics + per-sender engagement signals). No new content,
 * no message text — Invariant 1 holds by construction.
 *
 * This is a structural early-warning: it fires when the user is taking on load
 * (obligations, firehose volume, a lot of snoozing) *faster than they're
 * protecting time for it* — not a diagnosis, and it only ever leads to an
 * opt-in, human-in-the-loop suggestion (never an action).
 */

import type { SenderSignal, UserMetrics } from "../../ports/store.js";

export type LoadLevel = "calm" | "busy" | "heavy";

export interface LoadAssessment {
  level: LoadLevel;
  /** Raw load index (higher = heavier). Exposed for transparency/tests. */
  score: number;
  /** Plain-language reasons, most significant first. */
  drivers: string[];
  /** A gentle, opt-in next step — never taken automatically. */
  suggestion?: string;
}

export function analyzeLoad(
  metrics: UserMetrics | undefined,
  signals: SenderSignal[],
): LoadAssessment {
  const obligations = metrics?.obligationsSurfaced ?? 0;
  const triaged = metrics?.messagesTriaged ?? 0;
  const focusMin = metrics?.focusMinutesProtected ?? 0;
  const deprioritized = signals.reduce((n, s) => n + s.deprioritized, 0);

  // Load rises with obligations, firehose volume, and how much the user is
  // pushing away; protecting focus time relieves it.
  const score =
    obligations * 3 +
    Math.floor(triaged / 20) +
    deprioritized * 2 -
    Math.floor(focusMin / 30);

  const drivers: string[] = [];
  if (obligations >= 4) drivers.push(`${obligations} open obligations this week`);
  if (triaged >= 60) drivers.push(`a heavy inbox (${triaged} messages triaged)`);
  if (deprioritized >= 5) drivers.push(`you've snoozed ${deprioritized} items — a lot on your plate`);
  if (focusMin === 0 && (obligations >= 3 || triaged >= 40)) drivers.push("no focus time protected yet");

  const level: LoadLevel = score >= 24 ? "heavy" : score >= 12 ? "busy" : "calm";

  let suggestion: string | undefined;
  if (level !== "calm") {
    suggestion =
      focusMin === 0
        ? "Want me to block 90 minutes of protected focus time?"
        : "Want me to batch the non-urgent items so you're interrupted less?";
  }

  return { level, score, drivers, suggestion };
}
