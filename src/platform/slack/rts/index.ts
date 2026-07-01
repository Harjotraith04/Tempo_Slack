/**
 * RTS client factory. Returns the live adapter when TEMPO_RTS=live and a user
 * token is available; otherwise the seeded mock. Modules depend only on the
 * `RtsClient` interface and never know which is in play.
 */

import { config, isLiveRts } from "../../../config.js";
import { LiveRtsClient } from "./live.js";
import { MockRtsClient } from "./mock.js";
import { SUBJECT_USER_ID } from "./fixtures.js";
import type { RtsClient } from "../../../ports/rts.js";

export * from "../../../ports/rts.js";

export interface GetRtsOpts {
  /** Per-user token (from OAuth). Falls back to SLACK_USER_TOKEN for local demo. */
  userToken?: string;
  /** The Slack user id Tempo is acting as. */
  subjectUserId?: string;
}

export function getRtsClient(opts: GetRtsOpts = {}): RtsClient {
  const userToken = opts.userToken ?? config.slack.userToken;
  if (isLiveRts() && userToken) {
    return new LiveRtsClient({
      userToken,
      subjectUserId: opts.subjectUserId ?? SUBJECT_USER_ID,
    });
  }
  return new MockRtsClient();
}
