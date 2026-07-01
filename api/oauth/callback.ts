/**
 * OAuth callback. Exchanges the code, then stores the user's encrypted USER
 * token (authed_user.access_token) — the token Tempo runs RTS with.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { assertVercelRuntime } from "../../src/config.js";
import { getStore } from "../../src/platform/persistence/index.js";
import { exchangeCode } from "../../src/platform/slack/oauth/index.js";
import {
  parseCookies,
  statesMatch,
  clearStateCookie,
  OAUTH_STATE_COOKIE,
} from "../../src/shared/session.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  assertVercelRuntime();
  const url = new URL(req.url ?? "", "http://localhost");
  const code = url.searchParams.get("code");
  if (!code) {
    res.statusCode = 400;
    res.end("Missing code");
    return;
  }

  // CSRF: the query `state` must match the state cookie set at /api/oauth/start.
  const cookieState = parseCookies(req.headers.cookie)[OAUTH_STATE_COOKIE];
  if (!statesMatch(url.searchParams.get("state"), cookieState)) {
    res.statusCode = 400;
    res.end("Invalid OAuth state");
    return;
  }

  try {
    const redirectUri = `${process.env.PUBLIC_URL ?? ""}/api/oauth/callback`;
    const { userId, teamId, userToken } = await exchangeCode(code, redirectUri);

    if (userId && userToken) await getStore().tokens.save(userId, teamId ?? "", userToken);

    res.statusCode = 200;
    res.setHeader("Set-Cookie", clearStateCookie()); // single-use
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<html><body style="font-family:system-ui;padding:48px;max-width:520px;margin:auto">` +
        `<h2>Tempo is connected ✅</h2>` +
        `<p>You can close this tab and open the Tempo assistant in Slack. ` +
        `Tempo will only ever act with your own permissions, and never stores what it reads.</p>` +
        `</body></html>`,
    );
  } catch (err) {
    console.error("oauth callback error", err);
    res.statusCode = 500;
    res.end("OAuth failed");
  }
}
