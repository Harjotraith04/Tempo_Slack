/**
 * Suppression store — backs both "Snooze" and "Done" on triage items. Both are
 * the same concept (stop showing me this) with or without an expiry, so one
 * store covers both rather than inventing a second scheme.
 *
 * File-backed for the hackathon; swap `load`/`save` for Postgres in production
 * (see db/tokens.ts). COMPLIANCE: stores only a permalink + status, never
 * message content.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { storePath } from "./storePath.js";

// Resolved per call (not cached at module load) so TEMPO_STORE_DIR can be set
// after this module is imported — e.g. by scripts/demo.ts's main(), which
// statically imports through orchestrator.ts before it gets to run.
const FILENAME = ".tempo-snoozes.json";

export type SuppressionKind = "snooze" | "done";

export interface Suppression {
  userId: string;
  permalink: string;
  kind: SuppressionKind;
  /** Unix ts the suppression expires; undefined = indefinite ("done"). */
  until?: number;
  createdAt: number;
}

function recordKey(userId: string, permalink: string): string {
  return `${userId}::${permalink}`;
}

function load(): Record<string, Suppression> {
  const path = storePath(FILENAME);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function save(data: Record<string, Suppression>): void {
  writeFileSync(storePath(FILENAME), JSON.stringify(data, null, 2));
}

export function snoozeItem(userId: string, permalink: string, untilTs: number): Suppression {
  const data = load();
  const rec: Suppression = { userId, permalink, kind: "snooze", until: untilTs, createdAt: Math.floor(Date.now() / 1000) };
  data[recordKey(userId, permalink)] = rec;
  save(data);
  return rec;
}

export function markItemDone(userId: string, permalink: string): Suppression {
  const data = load();
  const rec: Suppression = { userId, permalink, kind: "done", createdAt: Math.floor(Date.now() / 1000) };
  data[recordKey(userId, permalink)] = rec;
  save(data);
  return rec;
}

export function isSuppressed(userId: string, permalink: string, nowTs: number): boolean {
  const rec = load()[recordKey(userId, permalink)];
  if (!rec) return false;
  if (rec.kind === "done") return true;
  return rec.until !== undefined && rec.until > nowTs;
}

export function activeSuppressions(userId: string, nowTs: number): Suppression[] {
  return Object.values(load()).filter(
    (rec) => rec.userId === userId && (rec.kind === "done" || (rec.until !== undefined && rec.until > nowTs)),
  );
}
