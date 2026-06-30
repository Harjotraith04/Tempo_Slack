/**
 * Slack-actions client factory. Returns the live adapter only when
 * TEMPO_SLACK_ACTIONS=live AND a user token is available; otherwise the mock —
 * same double-gate pattern as rts/index.ts's getRtsClient.
 */

import { config, isLiveSlackActions } from "../config.js";
import { LiveSlackActions } from "./live.js";
import { MockSlackActions } from "./mock.js";
import type { SlackActionsClient } from "./types.js";

export * from "./types.js";

export interface GetSlackActionsOpts {
  /** Per-user token (from OAuth). Falls back to SLACK_USER_TOKEN for local demo. */
  userToken?: string;
  botToken?: string;
}

export function getSlackActions(opts: GetSlackActionsOpts = {}): SlackActionsClient {
  const userToken = opts.userToken ?? config.slack.userToken;
  if (isLiveSlackActions() && userToken) {
    return new LiveSlackActions({ userToken, botToken: opts.botToken ?? config.slack.botToken });
  }
  return new MockSlackActions();
}
