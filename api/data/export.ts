/**
 * GET /api/data/export — download everything Tempo holds about you, as JSON.
 * The machine-readable half of the privacy dashboard.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { assertVercelRuntime } from "../../src/config.js";
import { getStore } from "../../src/platform/persistence/index.js";
import { exportUserData } from "../../src/application/use-cases/user-data.js";
import { userIdFromCookieHeader } from "../../src/shared/session.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  assertVercelRuntime();

  const userId = userIdFromCookieHeader(req.headers.cookie);
  if (!userId) {
    res.statusCode = 401;
    res.end("Not signed in");
    return;
  }

  const data = await exportUserData(getStore(), userId);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="tempo-data.json"');
  res.end(JSON.stringify(data, null, 2));
}
