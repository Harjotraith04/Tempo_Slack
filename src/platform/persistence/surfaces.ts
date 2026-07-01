/**
 * Native-surface handle store — remembers the Slack ids of the per-user Tempo
 * Canvas and Commitment-Ledger List so subsequent syncs *edit in place* rather
 * than creating duplicates. File-backed for the hackathon; swap load/save for
 * Postgres in production (see tokens.ts).
 *
 * COMPLIANCE: ids only — never any RTS content. A canvas/list id is an opaque
 * Slack handle, not message data.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { storePath } from "./storePath.js";

const FILENAME = ".tempo-surfaces.json";

export interface SurfaceHandles {
  userId: string;
  canvasId?: string;
  listId?: string;
  updatedAt: number;
}

function load(): Record<string, SurfaceHandles> {
  const path = storePath(FILENAME);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function save(data: Record<string, SurfaceHandles>): void {
  writeFileSync(storePath(FILENAME), JSON.stringify(data, null, 2));
}

export function getSurfaceHandles(userId: string): SurfaceHandles | undefined {
  return load()[userId];
}

export function getCanvasId(userId: string): string | undefined {
  return load()[userId]?.canvasId;
}

export function getListId(userId: string): string | undefined {
  return load()[userId]?.listId;
}

export function saveSurfaceHandles(
  userId: string,
  patch: Partial<Pick<SurfaceHandles, "canvasId" | "listId">>,
): SurfaceHandles {
  const data = load();
  const existing = data[userId];
  const next: SurfaceHandles = {
    ...existing,
    ...patch,
    userId,
    updatedAt: Math.floor(Date.now() / 1000),
  };
  data[userId] = next;
  save(data);
  return next;
}
