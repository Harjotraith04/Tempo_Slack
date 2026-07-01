/**
 * File-backed native-surface handle repo — remembers the Slack ids of the
 * per-user Tempo Canvas + Commitment List so syncs edit in place.
 * COMPLIANCE: ids only — an opaque Slack handle is never message data.
 */

import type { SurfacesRepo, SurfaceHandles } from "../../../ports/store.js";
import { nowSec } from "../logic.js";
import { storePath } from "../storePath.js";
import { loadMap, saveMap } from "./jsonFile.js";

const FILENAME = ".tempo-surfaces.json";
const path = () => storePath(FILENAME);

export function buildFileSurfacesRepo(): SurfacesRepo {
  const load = () => loadMap<SurfaceHandles>(path());

  return {
    async getHandles(userId) {
      return load()[userId];
    },
    async getCanvasId(userId) {
      return load()[userId]?.canvasId;
    },
    async getListId(userId) {
      return load()[userId]?.listId;
    },
    async save(userId, patch) {
      const data = load();
      const next: SurfaceHandles = { ...data[userId], ...patch, userId, updatedAt: nowSec() };
      data[userId] = next;
      saveMap(path(), data);
      return next;
    },
    async deleteForUser(userId) {
      const data = load();
      delete data[userId];
      saveMap(path(), data);
    },
  };
}
