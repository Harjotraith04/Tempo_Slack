/**
 * File-backed learned-signal repo (v2.8 Intelligence) — per-(user, sender)
 * engagement counts the triage ranker and tone decoder read.
 *
 * COMPLIANCE: integers + a sender id + a timestamp only. Never message text,
 * never anything RTS returns (Invariant: never persist RTS content).
 */

import type { SenderSignal, SignalsRepo } from "../../../ports/store.js";
import { addSignal, blankSignal, nowSec } from "../logic.js";
import { storePath } from "../storePath.js";
import { loadMap, saveMap } from "./jsonFile.js";

const FILENAME = ".tempo-signals.json";
const path = () => storePath(FILENAME);
const recordKey = (userId: string, authorId: string) => `${userId}::${authorId}`;

export function buildFileSignalsRepo(): SignalsRepo {
  const load = () => loadMap<SenderSignal>(path());

  return {
    async record(userId, authorId, kind, nowTs = nowSec()) {
      const data = load();
      const key = recordKey(userId, authorId);
      const next = addSignal(data[key] ?? blankSignal(userId, authorId, nowTs), kind, nowTs);
      data[key] = next;
      saveMap(path(), data);
      return next;
    },
    async forUser(userId) {
      return Object.values(load()).filter((s) => s.userId === userId);
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
