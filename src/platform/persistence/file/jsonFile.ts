/**
 * The one JSON read/write helper every file-backed repo shares. Each store is a
 * single map file keyed by userId (or `userId::permalink`); this is the load/save
 * seam the LEDGER always meant to swap for a DB — now the swap is a whole second
 * adapter (`../pg`) rather than editing these functions.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

export function loadMap<T>(path: string): Record<string, T> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, T>;
  } catch {
    return {};
  }
}

export function saveMap<T>(path: string, data: Record<string, T>): void {
  writeFileSync(path, JSON.stringify(data, null, 2));
}
