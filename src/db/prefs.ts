/**
 * Per-user preference store. File-backed for the hackathon; swap `load`/`save`
 * for Postgres (Neon) in production — same interface (see db/tokens.ts).
 *
 * COMPLIANCE: settings only, never RTS content.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { storePath } from "./storePath.js";

// Resolved per call (not cached at module load) so TEMPO_STORE_DIR can be set
// after this module is imported — e.g. by scripts/demo.ts's main(), which
// statically imports through orchestrator.ts before it gets to run.
const FILENAME = ".tempo-prefs.json";

export interface UserPrefs {
  userId: string;
  verbosity?: "brief" | "standard";
  readingLevel?: "plain" | "standard";
  readAloud?: boolean;
  maxItems?: number;
  focusDefaultMins?: number;
  dndDefaultMins?: number;
  lastActiveTs?: number;
  updatedAt: number;
}

function load(): Record<string, UserPrefs> {
  const path = storePath(FILENAME);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function save(data: Record<string, UserPrefs>): void {
  writeFileSync(storePath(FILENAME), JSON.stringify(data, null, 2));
}

export function getPrefs(userId: string): UserPrefs | undefined {
  return load()[userId];
}

export function savePrefs(
  userId: string,
  patch: Partial<Omit<UserPrefs, "userId" | "updatedAt">>,
): UserPrefs {
  const data = load();
  const existing = data[userId];
  const next: UserPrefs = { ...existing, ...patch, userId, updatedAt: Math.floor(Date.now() / 1000) };
  data[userId] = next;
  save(data);
  return next;
}
