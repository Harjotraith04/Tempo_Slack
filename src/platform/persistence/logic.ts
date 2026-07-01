/**
 * Shared, pure store logic — the decision rules both the file and Postgres
 * adapters reuse so their behavior can never drift (metrics weekly roll-over,
 * commitment local-override merge, suppression activeness). No I/O here.
 */

import type { Commitment, CommitmentStatus } from "../../modules/ledger.js";
import type {
  MetricCounts,
  PinnedCommitment,
  Suppression,
  UserMetrics,
} from "../../ports/store.js";

/** Current Unix time in **seconds** — every store keys timestamps this way. */
export const nowSec = (): number => Math.floor(Date.now() / 1000);

// ── Metrics ───────────────────────────────────────────────────────────────────

export const WEEK_SECS = 7 * 24 * 3600;

export function blankMetrics(userId: string, weekStartTs: number): UserMetrics {
  return {
    userId,
    messagesTriaged: 0,
    obligationsSurfaced: 0,
    focusMinutesProtected: 0,
    itemsRecovered: 0,
    weekStartTs,
    updatedAt: weekStartTs,
  };
}

/** The user's record for the current week, rolling over if the old one expired. */
export function currentWeek(userId: string, nowTs: number, existing?: UserMetrics): UserMetrics {
  if (!existing || nowTs - existing.weekStartTs >= WEEK_SECS) return blankMetrics(userId, nowTs);
  return existing;
}

/** Add the given counts onto a current-week record. */
export function addCounts(cur: UserMetrics, patch: Partial<MetricCounts>, nowTs: number): UserMetrics {
  return {
    ...cur,
    messagesTriaged: cur.messagesTriaged + (patch.messagesTriaged ?? 0),
    obligationsSurfaced: cur.obligationsSurfaced + (patch.obligationsSurfaced ?? 0),
    focusMinutesProtected: cur.focusMinutesProtected + (patch.focusMinutesProtected ?? 0),
    itemsRecovered: cur.itemsRecovered + (patch.itemsRecovered ?? 0),
    updatedAt: nowTs,
  };
}

// ── Commitments ────────────────────────────────────────────────────────────────

export const LOCAL_OVERRIDE_STATUSES = new Set<CommitmentStatus>(["renegotiating", "done"]);

/** COMPLIANCE: drop the raw message text before anything is persisted. */
export function stripSourceText(c: Commitment): Omit<Commitment, "sourceText"> {
  const { sourceText: _sourceText, ...rest } = c;
  return rest;
}

/** Build the row to persist for one fresh commitment, preserving the existing
 * local override (renegotiating/done) + pin/nudge metadata. */
export function mergePinned(
  userId: string,
  fresh: Commitment,
  existing: PinnedCommitment | undefined,
  nowTs: number,
): { row: PinnedCommitment; overrideStatus?: CommitmentStatus } {
  const overrideStatus =
    existing && LOCAL_OVERRIDE_STATUSES.has(existing.status) ? existing.status : undefined;
  const row: PinnedCommitment = {
    ...stripSourceText(fresh),
    status: overrideStatus ?? fresh.status,
    userId,
    pinnedAt: existing?.pinnedAt ?? nowTs,
    updatedAt: nowTs,
    renegotiationNote: existing?.renegotiationNote,
    lastNudgedAt: existing?.lastNudgedAt,
  };
  return { row, overrideStatus };
}

// ── Suppressions ────────────────────────────────────────────────────────────────

export function isActiveSuppression(rec: Suppression, nowTs: number): boolean {
  if (rec.kind === "done") return true;
  return rec.until !== undefined && rec.until > nowTs;
}
