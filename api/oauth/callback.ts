/**
 * OAuth callback. Exchanges the code, then stores the user's encrypted USER
 * token (authed_user.access_token) — the token Tempo runs RTS with.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { getStore } from "../../src/platform/persistence/index.js";
import { exchangeCode } from "../../src/platform/slack/oauth/index.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const code = new URL(req.url ?? "", "http://localhost").searchParams.get("code");
  if (!code) {
    res.statusCode = 400;
    res.end("Missing code");
    return;
  }

  try {
    const redirectUri = `${process.env.PUBLIC_URL ?? ""}/api/oauth/callback`;
    const { userId, teamId, userToken } = await exchangeCode(code, redirectUri);

    if (userId && userToken) await getStore().tokens.save(userId, teamId ?? "", userToken);

    res.statusCode = 200;
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
