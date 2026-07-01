/**
 * File-backed privacy-safe metrics repo — COUNTS ONLY, with a rolling weekly
 * window. COMPLIANCE: integers + timestamps only; never message text, channels,
 * people, or permalinks (Invariant: never persist RTS content).
 */

import type { MetricsRepo, UserMetrics } from "../../../ports/store.js";
import { addCounts, currentWeek, nowSec } from "../logic.js";
import { storePath } from "../storePath.js";
import { loadMap, saveMap } from "./jsonFile.js";

const FILENAME = ".tempo-metrics.json";
const path = () => storePath(FILENAME);

export function buildFileMetricsRepo(): MetricsRepo {
  const load = () => loadMap<UserMetrics>(path());

  return {
    async record(userId, patch, nowTs = nowSec()) {
      const data = load();
      const cur = currentWeek(userId, nowTs, data[userId]);
      const next = addCounts(cur, patch, nowTs);
      data[userId] = next;
      saveMap(path(), data);
      return next;
    },
    async get(userId, nowTs = nowSec()) {
      const rec = load()[userId];
      if (!rec) return undefined;
      // A stale (>1 week old) record reads as a fresh, empty week.
      return currentWeek(userId, nowTs, rec);
    },
    async deleteForUser(userId) {
      const data = load();
      delete data[userId];
      saveMap(path(), data);
    },
  };
}
