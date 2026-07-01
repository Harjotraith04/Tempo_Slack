/**
 * File-backed pinned-commitment repo — the user's own local action on a
 * commitment (renegotiating/done), layered over the live-derived Ledger.
 * COMPLIANCE: never stores `sourceText`; only derived facts + the user's note.
 */

import type { CommitmentsRepo, PinnedCommitment } from "../../../ports/store.js";
import { mergePinned, nowSec } from "../logic.js";
import { storePath } from "../storePath.js";
import { loadMap, saveMap } from "./jsonFile.js";

const FILENAME = ".tempo-commitments.json";
const path = () => storePath(FILENAME);
const recordKey = (userId: string, permalink: string) => `${userId}::${permalink}`;

export function buildFileCommitmentsRepo(): CommitmentsRepo {
  const load = () => loadMap<PinnedCommitment>(path());

  function patch(
    userId: string,
    permalink: string,
    fn: (existing: PinnedCommitment) => PinnedCommitment,
  ): PinnedCommitment | undefined {
    const data = load();
    const key = recordKey(userId, permalink);
    const existing = data[key];
    if (!existing) return undefined;
    const next = fn(existing);
    data[key] = next;
    saveMap(path(), data);
    return next;
  }

  return {
    async sync(userId, fresh) {
      const data = load();
      const now = nowSec();
      const result = fresh.map((c) => {
        const key = recordKey(userId, c.permalink);
        const { row, overrideStatus } = mergePinned(userId, c, data[key], now);
        data[key] = row;
        return overrideStatus ? { ...c, status: overrideStatus } : c;
      });
      saveMap(path(), data);
      return result;
    },
    async getByPermalink(userId, permalink) {
      return load()[recordKey(userId, permalink)];
    },
    async markRenegotiating(userId, permalink, note) {
      return patch(userId, permalink, (existing) => ({
        ...existing,
        status: "renegotiating",
        renegotiationNote: note ?? existing.renegotiationNote,
        updatedAt: nowSec(),
      }));
    },
    async markDone(userId, permalink) {
      return patch(userId, permalink, (existing) => ({
        ...existing,
        status: "done",
        updatedAt: nowSec(),
      }));
    },
    async markNudged(userId, permalink) {
      return patch(userId, permalink, (existing) => ({
        ...existing,
        lastNudgedAt: nowSec(),
      }));
    },
  };
}
