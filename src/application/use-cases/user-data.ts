/**
 * User-data governance use-cases (v2.6) — the backbone of the web companion's
 * privacy dashboard, data export, and right-to-erasure. Adapter-agnostic: these
 * compose the `Store` ports, so they work identically over the file and Postgres
 * adapters.
 *
 * COMPLIANCE: an export carries only derived facts + install/prefs metadata —
 * NEVER the decrypted user token (only `{teamId, installedAt}`) and NEVER any
 * RTS message content (commitments are `PinnedCommitment`, which omits
 * `sourceText`; metrics are counts only). Invariant 1 holds by construction.
 */

import { nowSec } from "../../platform/persistence/logic.js";
import type { Store, UserDataExport } from "../../ports/store.js";

/** Everything Tempo has stored for one user, for the dashboard / JSON export. */
export async function exportUserData(
  store: Store,
  userId: string,
  nowTs: number = nowSec(),
): Promise<UserDataExport> {
  const [installed, prefs, metrics, surfaces, commitments, snoozes, senderSignals] = await Promise.all([
    store.tokens.list(),
    store.prefs.get(userId),
    store.metrics.get(userId, nowTs),
    store.surfaces.getHandles(userId),
    store.commitments.listForUser(userId),
    store.snoozes.listForUser(userId),
    store.signals.forUser(userId),
  ]);
  const meta = installed.find((u) => u.userId === userId);
  return {
    userId,
    installedTeam: meta ? { teamId: meta.teamId, installedAt: meta.installedAt } : undefined,
    prefs,
    metrics,
    surfaces,
    commitments,
    snoozes,
    senderSignals,
    exportedAt: nowTs,
  };
}

/**
 * Right-to-erasure: forget everything stored for a user across all six stores.
 * The token is deleted LAST, so a partial failure never revokes access while
 * leaving other data behind (the caller can retry and still be authenticated).
 */
export async function deleteUserData(store: Store, userId: string): Promise<void> {
  await store.prefs.deleteForUser(userId);
  await store.commitments.deleteForUser(userId);
  await store.snoozes.deleteForUser(userId);
  await store.metrics.deleteForUser(userId);
  await store.surfaces.deleteForUser(userId);
  await store.signals.deleteForUser(userId);
  await store.tokens.deleteForUser(userId);
}
