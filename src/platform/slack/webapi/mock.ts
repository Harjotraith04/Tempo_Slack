/**
 * Mock Slack-actions adapter — deterministic, zero I/O. Used whenever
 * TEMPO_SLACK_ACTIONS=mock (the default), so `npm run demo`/tests can narrate
 * "Do-Not-Disturb on until…" without ever calling a real Slack API.
 */

import type {
  ScheduleDigestResult,
  SetFocusDndResult,
  SetFocusStatusResult,
  SlackActionsClient,
} from "../../../ports/slack.js";

export class MockSlackActions implements SlackActionsClient {
  async setFocusDnd(opts: { minutes: number }): Promise<SetFocusDndResult> {
    return { ok: true, nextDndEndTs: Math.floor(Date.now() / 1000) + opts.minutes * 60 };
  }

  async setFocusStatus(): Promise<SetFocusStatusResult> {
    return { ok: true };
  }

  async scheduleDigest(): Promise<ScheduleDigestResult> {
    return { ok: true, scheduledMessageId: "sched_mock_1" };
  }
}
