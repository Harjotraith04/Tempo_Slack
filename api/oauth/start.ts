/**
 * Begins per-user OAuth. Redirects to Slack's authorize screen requesting the
 * USER scopes Tempo needs for RTS (search:read.*) plus the bot scopes. The
 * resulting user token lets Tempo run RTS without an action_token.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { buildAuthorizeUrl } from "../../src/platform/slack/oauth/index.js";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const redirectUri = `${process.env.PUBLIC_URL ?? ""}/api/oauth/callback`;
  res.statusCode = 302;
  res.setHeader("Location", buildAuthorizeUrl(redirectUri));
  res.end();
}
