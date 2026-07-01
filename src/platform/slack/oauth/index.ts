/**
 * Shared Slack OAuth helpers — one implementation of the authorize-URL builder
 * and the code→token exchange, reused by both the Slack-install flow
 * (`api/oauth/*`) and the web companion's "Sign in with Slack" flow (`web/`).
 *
 * Tempo runs RTS with each user's own USER token (no action_token), so the
 * authorize request asks for the six `search:read.*` user scopes plus the bot
 * scopes the assistant surfaces need.
 */

import { WebClient } from "@slack/web-api";
import { config } from "../../../config.js";

export const USER_SCOPES = [
  "search:read.public",
  "search:read.private",
  "search:read.im",
  "search:read.mpim",
  "search:read.files",
  "search:read.users",
].join(",");

export const BOT_SCOPES = ["assistant:write", "chat:write", "im:write", "commands", "users:read"].join(",");

/** The Slack authorize URL to redirect the browser to. */
export function buildAuthorizeUrl(redirectUri: string): string {
  return (
    `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId ?? ""}` +
    `&scope=${encodeURIComponent(BOT_SCOPES)}` +
    `&user_scope=${encodeURIComponent(USER_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`
  );
}

export interface OAuthExchange {
  userId?: string;
  teamId?: string;
  userToken?: string;
}

/** Exchange an OAuth `code` for the user's token + identity. */
export async function exchangeCode(code: string, redirectUri: string): Promise<OAuthExchange> {
  const web = new WebClient();
  const result = (await web.oauth.v2.access({
    client_id: config.slack.clientId!,
    client_secret: config.slack.clientSecret!,
    code,
    redirect_uri: redirectUri,
  })) as any;
  return {
    userId: result.authed_user?.id,
    teamId: result.team?.id,
    userToken: result.authed_user?.access_token,
  };
}
