/**
 * Shared Slack OAuth helpers — one implementation of the authorize-URL builder
 * and the code→token exchange, reused by both the Slack-install flow
 * (`api/oauth/*`) and the web companion's "Sign in with Slack" flow (`web/`).
 *
 * The exact scopes requested are the least-privilege, audited set declared in
 * `scopes.ts` (the single source of truth `manifest.json` is checked against).
 */

import { WebClient } from "@slack/web-api";
import { config } from "../../../config.js";
import { USER_SCOPES, BOT_SCOPES } from "./scopes.js";

export { USER_SCOPES, BOT_SCOPES } from "./scopes.js";

/** The Slack authorize URL to redirect the browser to. Pass a `state` (from
 * `newOAuthState()`) to enable CSRF protection on the callback. */
export function buildAuthorizeUrl(redirectUri: string, state?: string): string {
  return (
    `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId ?? ""}` +
    `&scope=${encodeURIComponent(BOT_SCOPES.join(","))}` +
    `&user_scope=${encodeURIComponent(USER_SCOPES.join(","))}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    (state ? `&state=${encodeURIComponent(state)}` : "")
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
