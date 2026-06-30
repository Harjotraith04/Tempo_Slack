/**
 * OAuth callback. Exchanges the code, then stores the user's encrypted USER
 * token (authed_user.access_token) — the token Tempo runs RTS with.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { WebClient } from "@slack/web-api";
import { config } from "../../src/config.js";
import { saveUserToken } from "../../src/db/tokens.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const code = new URL(req.url ?? "", "http://localhost").searchParams.get("code");
  if (!code) {
    res.statusCode = 400;
    res.end("Missing code");
    return;
  }

  try {
    const web = new WebClient();
    const result = (await web.oauth.v2.access({
      client_id: config.slack.clientId!,
      client_secret: config.slack.clientSecret!,
      code,
      redirect_uri: `${process.env.PUBLIC_URL ?? ""}/api/oauth/callback`,
    })) as any;

    const userId: string = result.authed_user?.id;
    const teamId: string = result.team?.id;
    const userToken: string | undefined = result.authed_user?.access_token;

    if (userId && userToken) saveUserToken(userId, teamId ?? "", userToken);

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
