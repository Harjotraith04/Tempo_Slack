/**
 * Begins per-user OAuth. Redirects to Slack's authorize screen requesting the
 * USER scopes Tempo needs for RTS (search:read.*) plus the bot scopes. The
 * resulting user token lets Tempo run RTS without an action_token.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { assertVercelRuntime } from "../../src/config.js";
import { buildAuthorizeUrl } from "../../src/platform/slack/oauth/index.js";
import { newOAuthState, serializeStateCookie } from "../../src/shared/session.js";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  assertVercelRuntime();
  const redirectUri = `${process.env.PUBLIC_URL ?? ""}/api/oauth/callback`;
  // CSRF protection: remember a random state and echo it to Slack.
  const state = newOAuthState();
  res.statusCode = 302;
  res.setHeader("Set-Cookie", serializeStateCookie(state));
  res.setHeader("Location", buildAuthorizeUrl(redirectUri, state));
  res.end();
}
