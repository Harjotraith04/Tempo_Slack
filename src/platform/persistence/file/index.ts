/**
 * File-backed Store adapter (the default) — assembles the six JSON-file repos
 * into one `Store`. Fine for local Socket-Mode dev and the zero-credential
 * demo/tests; the Postgres adapter (../pg) is the durable production path.
 */

import type { Store } from "../../../ports/store.js";
import { buildFileTokensRepo } from "./tokens.js";
import { buildFilePrefsRepo } from "./prefs.js";
import { buildFileCommitmentsRepo } from "./commitments.js";
import { buildFileSnoozesRepo } from "./snoozes.js";
import { buildFileMetricsRepo } from "./metrics.js";
import { buildFileSurfacesRepo } from "./surfaces.js";
import { buildFileSignalsRepo } from "./signals.js";

export function buildFileStore(): Store {
  return {
    tokens: buildFileTokensRepo(),
    prefs: buildFilePrefsRepo(),
    commitments: buildFileCommitmentsRepo(),
    snoozes: buildFileSnoozesRepo(),
    metrics: buildFileMetricsRepo(),
    surfaces: buildFileSurfacesRepo(),
    signals: buildFileSignalsRepo(),
  };
}
