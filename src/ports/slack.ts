/**
 * Slack-native action surface — the Focus Guardian's "real" effects beyond MCP
 * calendar/task: DND, status, and a scheduled non-disruptive digest.
 *
 * Mirrors the rts/{types,index,mock,live} split: modules depend only on this
 * interface, never on `@slack/web-api` directly, so mock/live swap with zero
 * changes upstream and the zero-credential demo/tests stay deterministic.
 *
 * COMPLIANCE: these calls only ever fire as the direct result of a user's own
 * request (a focus ask, a button tap) — never proactively.
 */

export interface SetFocusDndResult {
  ok: boolean;
  nextDndEndTs?: number;
}

export interface SetFocusStatusResult {
  ok: boolean;
}

export interface ScheduleDigestResult {
  ok: boolean;
  scheduledMessageId?: string;
}

export interface SlackActionsClient {
  setFocusDnd(opts: { minutes: number }): Promise<SetFocusDndResult>;
  setFocusStatus(opts: { statusText: string; statusEmoji?: string; expirationTs?: number }): Promise<SetFocusStatusResult>;
  scheduleDigest(opts: { userId: string; postAtTs: number; text: string }): Promise<ScheduleDigestResult>;
}
