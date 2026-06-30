/**
 * Begins per-user OAuth. Redirects to Slack's authorize screen requesting the
 * USER scopes Tempo needs for RTS (search:read.*) plus the bot scopes. The
 * resulting user token lets Tempo run RTS without an action_token.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { config } from "../../src/config.js";

const USER_SCOPES = [
  "search:read.public",
  "search:read.private",
  "search:read.im",
  "search:read.mpim",
  "search:read.files",
  "search:read.users",
].join(",");

const BOT_SCOPES = ["assistant:write", "chat:write", "im:write", "commands", "users:read"].join(",");

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const redirectUri = `${process.env.PUBLIC_URL ?? ""}/api/oauth/callback`;
  const url =
    `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId ?? ""}` +
    `&scope=${encodeURIComponent(BOT_SCOPES)}` +
    `&user_scope=${encodeURIComponent(USER_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}
