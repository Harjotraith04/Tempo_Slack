/**
 * Slack-native write-action surface — every "real" effect Tempo has in a
 * workspace beyond MCP calendar/task: focus DND/status, a scheduled digest,
 * plus the v2.0 native surfaces (Tempo Canvas, Slack Lists sync, reminders,
 * bookmarks).
 *
 * Mirrors the rts/{types,index,mock,live} split: callers depend only on this
 * interface, never on `@slack/web-api` directly, so mock/live swap with zero
 * changes upstream and the zero-credential demo/tests stay deterministic.
 *
 * COMPLIANCE: these calls only ever fire as the direct result of a user's own
 * request (a focus ask, a button tap, a workflow step) or the user's own
 * morning-digest cron — never unsolicited. Only derived facts are ever written
 * (a canvas of today's plan, a list row of a commitment); raw RTS content isn't.
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

export interface UpsertCanvasResult {
  ok: boolean;
  canvasId?: string;
}

/** A single row synced to a Slack List — derived commitment facts only, never
 * the source message text (Invariant 1). `direction`/`status` are plain strings
 * so the port stays decoupled from the Ledger domain types. */
export interface ListItem {
  what: string;
  counterparty: string;
  direction: string;
  status: string;
  dueText?: string;
  permalink: string;
}

export interface SyncListResult {
  ok: boolean;
  listId?: string;
  itemsWritten?: number;
}

export interface AddReminderResult {
  ok: boolean;
  reminderId?: string;
}

export interface AddBookmarkResult {
  ok: boolean;
  bookmarkId?: string;
}

export interface SlackActionsClient {
  setFocusDnd(opts: { minutes: number }): Promise<SetFocusDndResult>;
  setFocusStatus(opts: { statusText: string; statusEmoji?: string; expirationTs?: number }): Promise<SetFocusStatusResult>;
  scheduleDigest(opts: { userId: string; postAtTs: number; text: string }): Promise<ScheduleDigestResult>;
  /** Create (no canvasId) or replace-in-place (canvasId) the user's living
   * Tempo Canvas from a Markdown document. */
  upsertCanvas(opts: { canvasId?: string; title: string; markdown: string }): Promise<UpsertCanvasResult>;
  /** Create (no listId) or refresh a Slack List of the Commitment Ledger. */
  syncListItems(opts: { listId?: string; title: string; items: ListItem[] }): Promise<SyncListResult>;
  /** Set a native Slack reminder (e.g. before an at-risk commitment slips). */
  addReminder(opts: { text: string; time: number }): Promise<AddReminderResult>;
  /** Pin a channel bookmark (e.g. linking the Tempo Canvas). */
  addBookmark(opts: { channelId: string; title: string; link: string }): Promise<AddBookmarkResult>;
}
