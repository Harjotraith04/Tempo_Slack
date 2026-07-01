/**
 * File-backed suppression repo — backs both "Snooze" (with expiry) and "Done"
 * (indefinite). COMPLIANCE: stores only a permalink + status, never content.
 */

import type { SnoozesRepo, Suppression } from "../../../ports/store.js";
import { isActiveSuppression, nowSec } from "../logic.js";
import { storePath } from "../storePath.js";
import { loadMap, saveMap } from "./jsonFile.js";

const FILENAME = ".tempo-snoozes.json";
const path = () => storePath(FILENAME);
const recordKey = (userId: string, permalink: string) => `${userId}::${permalink}`;

export function buildFileSnoozesRepo(): SnoozesRepo {
  const load = () => loadMap<Suppression>(path());

  function put(rec: Suppression): Suppression {
    const data = load();
    data[recordKey(rec.userId, rec.permalink)] = rec;
    saveMap(path(), data);
    return rec;
  }

  return {
    async snooze(userId, permalink, untilTs) {
      return put({ userId, permalink, kind: "snooze", until: untilTs, createdAt: nowSec() });
    },
    async markDone(userId, permalink) {
      return put({ userId, permalink, kind: "done", createdAt: nowSec() });
    },
    async isSuppressed(userId, permalink, nowTs) {
      const rec = load()[recordKey(userId, permalink)];
      return rec ? isActiveSuppression(rec, nowTs) : false;
    },
    async active(userId, nowTs) {
      return Object.values(load()).filter(
        (rec) => rec.userId === userId && isActiveSuppression(rec, nowTs),
      );
    },
    async listForUser(userId) {
      return Object.values(load()).filter((rec) => rec.userId === userId);
    },
    async deleteForUser(userId) {
      const data = load();
      for (const [key, rec] of Object.entries(data)) {
        if (rec.userId === userId) delete data[key];
      }
      saveMap(path(), data);
    },
  };
}
