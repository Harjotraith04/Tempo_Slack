/**
 * File-backed encrypted user-token repo. Tokens are sensitive, so the token
 * material is AES-256-GCM encrypted at rest (see ../crypto.ts).
 *
 * NOTE: this store keeps its historical hardcoded path (`.tempo-store.json`) and
 * does NOT route through `storePath()`/`TEMPO_STORE_DIR` — that seam post-dates
 * it and isn't in scope to change. The Postgres adapter (../pg) is the real
 * production path.
 *
 * COMPLIANCE: stores ONLY auth tokens + install metadata, never RTS content.
 */

import type { InstalledUser, TokensRepo } from "../../../ports/store.js";
import { encrypt, decrypt } from "../crypto.js";
import { nowSec } from "../logic.js";
import { loadMap, saveMap } from "./jsonFile.js";

const STORE_PATH = ".tempo-store.json";

interface StoredRecord {
  userId: string;
  teamId: string;
  /** iv:tag:ciphertext, all base64 */
  enc: string;
  installedAt: number;
}

export function buildFileTokensRepo(): TokensRepo {
  const load = () => loadMap<StoredRecord>(STORE_PATH);
  return {
    async save(userId, teamId, userToken) {
      const data = load();
      data[userId] = { userId, teamId, enc: encrypt(userToken), installedAt: nowSec() };
      saveMap(STORE_PATH, data);
    },
    async get(userId) {
      const rec = load()[userId];
      return rec ? decrypt(rec.enc) : undefined;
    },
    async list(): Promise<InstalledUser[]> {
      return Object.values(load()).map(({ userId, teamId, installedAt }) => ({
        userId,
        teamId,
        installedAt,
      }));
    },
    async deleteForUser(userId) {
      const data = load();
      delete data[userId];
      saveMap(STORE_PATH, data);
    },
  };
}
