/**
 * Privacy-safe usage metrics — COUNTS ONLY. File-backed for the hackathon; swap
 * `load`/`save` for Postgres (Neon) in production — same interface (see
 * db/prefs.ts).
 *
 * These are the KPIs Tempo reports back to the user ("your week with Tempo"):
 * how many messages it triaged, how many obligations it surfaced, how many
 * focus-minutes it protected, and how many items it helped you recover.
 *
 * COMPLIANCE: this store holds integers and timestamps only. It never records
 * message text, channels, people, permalinks, or anything else RTS returns
 * (invariant: never persist RTS content).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { storePath } from "./storePath.js";

const FILENAME = ".tempo-metrics.json";
const WEEK_SECS = 7 * 24 * 3600;

export interface UserMetrics {
  userId: string;
  messagesTriaged: number;
  obligationsSurfaced: number;
  focusMinutesProtected: number;
  itemsRecovered: number;
  /** Start of the current rolling week; counts reset when it ages past 7 days. */
  weekStartTs: number;
  updatedAt: number;
}

/** The count fields a caller may increment. */
export type MetricCounts = Pick<
  UserMetrics,
  "messagesTriaged" | "obligationsSurfaced" | "focusMinutesProtected" | "itemsRecovered"
>;

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function load(): Record<string, UserMetrics> {
  const path = storePath(FILENAME);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function save(data: Record<string, UserMetrics>): void {
  writeFileSync(storePath(FILENAME), JSON.stringify(data, null, 2));
}

function blank(userId: string, weekStartTs: number): UserMetrics {
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
function currentWeek(userId: string, nowTs: number, existing?: UserMetrics): UserMetrics {
  if (!existing || nowTs - existing.weekStartTs >= WEEK_SECS) return blank(userId, nowTs);
  return existing;
}

/** Adds the given counts to the user's current-week totals. `nowTs` is injectable for tests. */
export function recordMetrics(
  userId: string,
  patch: Partial<MetricCounts>,
  nowTs: number = now(),
): UserMetrics {
  const data = load();
  const cur = currentWeek(userId, nowTs, data[userId]);
  const next: UserMetrics = {
    ...cur,
    messagesTriaged: cur.messagesTriaged + (patch.messagesTriaged ?? 0),
    obligationsSurfaced: cur.obligationsSurfaced + (patch.obligationsSurfaced ?? 0),
    focusMinutesProtected: cur.focusMinutesProtected + (patch.focusMinutesProtected ?? 0),
    itemsRecovered: cur.itemsRecovered + (patch.itemsRecovered ?? 0),
    updatedAt: nowTs,
  };
  data[userId] = next;
  save(data);
  return next;
}

/** The user's current-week metrics, or undefined if they have none yet. */
export function getMetrics(userId: string, nowTs: number = now()): UserMetrics | undefined {
  const rec = load()[userId];
  if (!rec) return undefined;
  // A stale (>1 week old) record reads as a fresh, empty week.
  return currentWeek(userId, nowTs, rec);
}
