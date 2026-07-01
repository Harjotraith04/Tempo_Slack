/**
 * Mock Slack-actions adapter — deterministic, zero I/O. Used whenever
 * TEMPO_SLACK_ACTIONS=mock (the default), so `npm run demo`/tests can narrate
 * "Do-Not-Disturb on until…" without ever calling a real Slack API.
 */

import type {
  AddBookmarkResult,
  AddReminderResult,
  ListItem,
  ScheduleDigestResult,
  SetFocusDndResult,
  SetFocusStatusResult,
  SlackActionsClient,
  SyncListResult,
  UpsertCanvasResult,
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

  async upsertCanvas(opts: { canvasId?: string; title: string; markdown: string }): Promise<UpsertCanvasResult> {
    // Echo the existing id on edit, mint a stable one on create — deterministic
    // so the demo can narrate "created → refreshed the same canvas".
    return { ok: true, canvasId: opts.canvasId ?? "canvas_mock_1" };
  }

  async syncListItems(opts: { listId?: string; title: string; items: ListItem[] }): Promise<SyncListResult> {
    return { ok: true, listId: opts.listId ?? "list_mock_1", itemsWritten: opts.items.length };
  }

  async addReminder(): Promise<AddReminderResult> {
    return { ok: true, reminderId: "reminder_mock_1" };
  }

  async addBookmark(): Promise<AddBookmarkResult> {
    return { ok: true, bookmarkId: "bookmark_mock_1" };
  }
}
