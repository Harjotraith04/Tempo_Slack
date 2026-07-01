/**
 * Store factory — the single config-gated seam that resolves the persistence
 * adapter, mirroring `getRtsClient` / `getMcpClients`. Double-gated: the Postgres
 * store is used only when `TEMPO_STORE=postgres` (or `DATABASE_URL` auto-detects
 * it) AND a `DATABASE_URL` is actually configured; otherwise the file store is
 * the default. This keeps the zero-credential demo/tests on files, and the Neon
 * driver is never even imported on that path (see pg/connect.ts).
 *
 * Resolved once per process and cached — the file adapter re-reads
 * TEMPO_STORE_DIR per call, so a cached instance still honors test isolation.
 */

import { config, isPostgresStore } from "../../config.js";
import type { Store } from "../../ports/store.js";
import { buildFileStore } from "./file/index.js";
import { buildPgStore } from "./pg/index.js";
import { connectNeon } from "./pg/connect.js";

let cached: Store | undefined;

export function getStore(): Store {
  if (!cached) cached = resolveStore();
  return cached;
}

function resolveStore(): Store {
  if (isPostgresStore() && config.store.databaseUrl) {
    return buildPgStore(connectNeon(config.store.databaseUrl));
  }
  return buildFileStore();
}

export { buildFileStore, buildPgStore, connectNeon };
export type { Store } from "../../ports/store.js";
