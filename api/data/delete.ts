/**
 * POST /api/data/delete — erase everything and sign out.
 *
 * Immediate and total: the user never has to ask anyone to exercise erasure,
 * which is the point of the whole privacy posture.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { assertVercelRuntime } from "../../src/config.js";
import { getStore } from "../../src/platform/persistence/index.js";
import { deleteUserData } from "../../src/application/use-cases/user-data.js";
import { userIdFromCookieHeader, clearSessionCookie } from "../../src/shared/session.js";
import { html, page } from "../../src/platform/web/render.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  assertVercelRuntime();

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  const userId = userIdFromCookieHeader(req.headers.cookie);
  if (!userId) {
    res.statusCode = 401;
    res.end("Not signed in");
    return;
  }

  await deleteUserData(getStore(), userId);

  // Erased, so the session is meaningless — clear it in the same response.
  res.setHeader("Set-Cookie", clearSessionCookie());
  html(
    res,
    page(
      "Deleted",
      `<h2>Everything has been deleted ✅</h2>
<p>Your token, preferences, commitments, snoozes, metrics, and surface ids are gone, and you've been
signed out. Nothing of yours remains.</p>
<p>Tempo never stored what it read from Slack in the first place, so there was nothing else to erase.</p>
<p><a class="btn secondary" href="/">← Back to Tempo</a></p>`,
    ),
  );
}
