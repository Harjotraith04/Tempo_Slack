/**
 * Pinned-commitment store — holds the user's own pending action on a
 * commitment (renegotiating / done), not the commitment itself. The Ledger is
 * always rebuilt live from RTS (see modules/ledger.ts); `syncCommitments` only
 * layers the user's local override status on top of that live truth so the
 * rendered view never depends solely on persisted (possibly stale) data.
 *
 * File-backed for the hackathon; swap `load`/`save` for Postgres in production
 * (see db/tokens.ts). COMPLIANCE: never stores `sourceText` / raw message
 * content — only derived facts (what/counterparty/due/permalink) plus the
 * user's own renegotiation note.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { storePath } from "./storePath.js";
import type { Commitment } from "../modules/ledger.js";

// Resolved per call (not cached at module load) so TEMPO_STORE_DIR can be set
// after this module is imported — e.g. by scripts/demo.ts's main(), which
// statically imports through orchestrator.ts before it gets to run.
const FILENAME = ".tempo-commitments.json";

export interface PinnedCommitment extends Omit<Commitment, "sourceText"> {
  userId: string;
  pinnedAt: number;
  updatedAt: number;
  renegotiationNote?: string;
  lastNudgedAt?: number;
}

const LOCAL_OVERRIDE_STATUSES = new Set<Commitment["status"]>(["renegotiating", "done"]);

function recordKey(userId: string, permalink: string): string {
  return `${userId}::${permalink}`;
}

function load(): Record<string, PinnedCommitment> {
  const path = storePath(FILENAME);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function save(data: Record<string, PinnedCommitment>): void {
  writeFileSync(storePath(FILENAME), JSON.stringify(data, null, 2));
}

function stripSourceText(c: Commitment): Omit<Commitment, "sourceText"> {
  const { sourceText: _sourceText, ...rest } = c;
  return rest;
}

/**
 * Upserts each live-derived commitment into the store, preserving a local
 * override status (renegotiating/done) if one already exists, and returns
 * `fresh` re-rendered with that override applied. The store never becomes the
 * source of truth for what/due/counterparty — only for the user's own
 * pending-action state.
 */
export function syncCommitments(userId: string, fresh: Commitment[]): Commitment[] {
  const data = load();
  const now = Math.floor(Date.now() / 1000);

  const result = fresh.map((c) => {
    const key = recordKey(userId, c.permalink);
    const existing = data[key];
    const overrideStatus =
      existing && LOCAL_OVERRIDE_STATUSES.has(existing.status) ? existing.status : undefined;

    data[key] = {
      ...stripSourceText(c),
      status: overrideStatus ?? c.status,
      userId,
      pinnedAt: existing?.pinnedAt ?? now,
      updatedAt: now,
      renegotiationNote: existing?.renegotiationNote,
      lastNudgedAt: existing?.lastNudgedAt,
    };

    return overrideStatus ? { ...c, status: overrideStatus } : c;
  });

  save(data);
  return result;
}

export function getCommitmentByPermalink(userId: string, permalink: string): PinnedCommitment | undefined {
  return load()[recordKey(userId, permalink)];
}

export function markRenegotiating(userId: string, permalink: string, note?: string): PinnedCommitment | undefined {
  const data = load();
  const key = recordKey(userId, permalink);
  const existing = data[key];
  if (!existing) return undefined;
  const next: PinnedCommitment = {
    ...existing,
    status: "renegotiating",
    renegotiationNote: note ?? existing.renegotiationNote,
    updatedAt: Math.floor(Date.now() / 1000),
  };
  data[key] = next;
  save(data);
  return next;
}

export function markCommitmentDone(userId: string, permalink: string): PinnedCommitment | undefined {
  const data = load();
  const key = recordKey(userId, permalink);
  const existing = data[key];
  if (!existing) return undefined;
  const next: PinnedCommitment = { ...existing, status: "done", updatedAt: Math.floor(Date.now() / 1000) };
  data[key] = next;
  save(data);
  return next;
}

export function markNudged(userId: string, permalink: string): PinnedCommitment | undefined {
  const data = load();
  const key = recordKey(userId, permalink);
  const existing = data[key];
  if (!existing) return undefined;
  const next: PinnedCommitment = { ...existing, lastNudgedAt: Math.floor(Date.now() / 1000) };
  data[key] = next;
  save(data);
  return next;
}
