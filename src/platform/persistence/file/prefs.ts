/** File-backed per-user preference repo. Settings only, never RTS content. */

import type { PrefsRepo, UserPrefs } from "../../../ports/store.js";
import { nowSec } from "../logic.js";
import { storePath } from "../storePath.js";
import { loadMap, saveMap } from "./jsonFile.js";

const FILENAME = ".tempo-prefs.json";
// Resolved per call so TEMPO_STORE_DIR can be set after this module is imported.
const path = () => storePath(FILENAME);

export function buildFilePrefsRepo(): PrefsRepo {
  return {
    async get(userId) {
      return loadMap<UserPrefs>(path())[userId];
    },
    async save(userId, patch) {
      const data = loadMap<UserPrefs>(path());
      const next: UserPrefs = { ...data[userId], ...patch, userId, updatedAt: nowSec() };
      data[userId] = next;
      saveMap(path(), data);
      return next;
    },
    async deleteForUser(userId) {
      const data = loadMap<UserPrefs>(path());
      delete data[userId];
      saveMap(path(), data);
    },
  };
}
