/**
 * The ONLY file that touches `@neondatabase/serverless`.
 *
 * `connectNeon` returns a lazily-connecting `Db`: the driver is `await import`ed
 * on the *first* query, so the file/mock/demo/test paths (which never resolve to
 * the Postgres store) never load it — the zero-credential path can't be broken
 * even by a driver ESM quirk. The connection is established once, the schema
 * migrations run once, and the result is cached for the process's lifetime.
 *
 * UNVERIFIED LIVE SEAM: like `mcp/connect.ts` and `rts/live.ts`, this is
 * contract-shaped but not run against a real database in CI (`npm run
 * verify:postgres` checks it against a real Neon URL). The `Db` boundary keeps
 * any driver API drift contained to this one file.
 */

import type { Db } from "./session.js";
import { MIGRATIONS } from "./migrations.js";

export function connectNeon(databaseUrl: string): Db {
  // Cached, migrated query runner — created on first use.
  let runnerPromise: Promise<(text: string, params: unknown[]) => Promise<unknown[]>> | undefined;

  async function runner() {
    if (!runnerPromise) {
      runnerPromise = (async () => {
        const { neon } = await import("@neondatabase/serverless");
        // The query function is called directly with (queryString, params); by
        // default it resolves to the result rows as an array of objects.
        const sql = neon(databaseUrl);
        const run = (text: string, params: unknown[] = []) =>
          sql(text, params) as Promise<unknown[]>;
        // Idempotent schema — safe to run on every cold start.
        for (const stmt of MIGRATIONS) await run(stmt, []);
        return run;
      })();
    }
    return runnerPromise;
  }

  return {
    async query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
      const run = await runner();
      return (await run(text, params)) as T[];
    },
  };
}
