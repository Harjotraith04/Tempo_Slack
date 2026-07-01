/**
 * Postgres-backed Store adapter — assembles the six pg repos over one `Db`
 * connection. `buildPgStore(db)` takes the seam (not the driver), so it's
 * unit-testable against a fake in-memory Db; the factory (../index.ts) wires the
 * real lazy Neon connection only when the Postgres store is configured.
 */

import type { Store } from "../../../ports/store.js";
import type { Db } from "./session.js";
import {
  buildPgTokensRepo,
  buildPgPrefsRepo,
  buildPgCommitmentsRepo,
  buildPgSnoozesRepo,
  buildPgMetricsRepo,
  buildPgSurfacesRepo,
  buildPgSignalsRepo,
} from "./repos.js";

export function buildPgStore(db: Db): Store {
  return {
    tokens: buildPgTokensRepo(db),
    prefs: buildPgPrefsRepo(db),
    commitments: buildPgCommitmentsRepo(db),
    snoozes: buildPgSnoozesRepo(db),
    metrics: buildPgMetricsRepo(db),
    surfaces: buildPgSurfacesRepo(db),
    signals: buildPgSignalsRepo(db),
  };
}
