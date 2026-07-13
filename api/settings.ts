/**
 * POST /api/settings — save the web settings form.
 *
 * Goes through `applySettings`, the same use-case the Slack settings modal
 * writes through, so the two surfaces cannot drift apart.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { assertVercelRuntime } from "../src/config.js";
import { getStore } from "../src/platform/persistence/index.js";
import { applySettings } from "../src/application/use-cases/settings.js";
import { userIdFromCookieHeader } from "../src/shared/session.js";
import { readForm, redirect } from "../src/platform/web/render.js";

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

  await applySettings(getStore(), userId, await readForm(req));

  // 303: turn the POST into a GET so a refresh doesn't resubmit the form.
  redirect(res, "/settings?saved=1", 303);
}
