/**
 * Standalone live-Postgres check — mirrors verify-live-rts.ts / verify-live-mcp.ts.
 *
 * NEVER imported by the app/orchestrator/tests, and NOT wired into `npm test` /
 * `npm run demo`, so it can't break the zero-credential path. With no
 * DATABASE_URL it prints a clear "skipped" and exits 0; with one it connects,
 * applies the (idempotent) schema, and does a NON-DESTRUCTIVE round-trip —
 * write → read → delete of a single throwaway synthetic row — then reports.
 *
 *   npm run verify:postgres
 */

import "dotenv/config";
import { config } from "../src/config.js";
import { connectNeon } from "../src/platform/persistence/pg/connect.js";

const MARKER = "__tempo_verify_throwaway__";

async function main() {
  const url = config.store.databaseUrl;
  if (!url) {
    console.log("Live Postgres verification skipped — no DATABASE_URL configured.");
    console.log("Set DATABASE_URL (and optionally TEMPO_STORE=postgres) to verify against a real Neon database.");
    process.exit(0);
  }

  console.log("Connecting to Postgres and applying the schema (idempotent CREATE TABLE IF NOT EXISTS)…");
  // The Neon driver is dynamic-imported inside connectNeon on the first query,
  // and the migrations run there — so this line already exercises the schema.
  const db = connectNeon(url);

  // Non-destructive round-trip on a clearly-synthetic throwaway row.
  await db.query(
    `INSERT INTO tempo_prefs (user_id, updated_at) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = $2`,
    [MARKER, 1],
  );
  const rows = await db.query<{ user_id: string }>(
    `SELECT user_id FROM tempo_prefs WHERE user_id = $1`,
    [MARKER],
  );
  await db.query(`DELETE FROM tempo_prefs WHERE user_id = $1`, [MARKER]);

  const ok = rows.length === 1;
  if (ok) {
    console.log("✅ Round-trip OK — schema applied; write, read, and delete of a throwaway row all succeeded.");
    console.log("The Postgres store adapter's query path works against this database.");
    process.exit(0);
  }
  console.log("❌ Round-trip failed — the throwaway row did not read back. Check the DATABASE_URL and permissions.");
  process.exit(1);
}

main().catch((err) => {
  console.error("Live Postgres verification failed:", err);
  process.exit(1);
});
