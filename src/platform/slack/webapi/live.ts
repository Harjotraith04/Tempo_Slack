/**
 * Live Slack-actions adapter. `setFocusDnd`/`setFocusStatus` use the user's own
 * token (dnd:write / users.profile:write) — Tempo is acting as the user, not a
 * bot. `scheduleDigest` needs a bot token + im:write/chat:write (same
 * conversations.open → chat.scheduleMessage two-step already used by
 * api/cron/morning-digest.ts) since DMing on the user's behalf goes through the
 * bot identity.
 *
 * Best-effort: never throws into the caller — Focus Guardian's calendar/task
 * block via MCP must still succeed even if a Slack-native call fails.
 */

import { WebClient } from "@slack/web-api";
import { webClientOptions } from "../../../shared/webClientOptions.js";
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

interface LiveOpts {
  userToken: string;
  botToken?: string;
}

export class LiveSlackActions implements SlackActionsClient {
  private readonly userWeb: WebClient;
  private readonly botWeb?: WebClient;

  constructor(opts: LiveOpts) {
    this.userWeb = new WebClient(opts.userToken, webClientOptions);
    this.botWeb = opts.botToken ? new WebClient(opts.botToken, webClientOptions) : undefined;
  }

  async setFocusDnd(opts: { minutes: number }): Promise<SetFocusDndResult> {
    try {
      const res = (await this.userWeb.dnd.setSnooze({ num_minutes: opts.minutes })) as {
        ok?: boolean;
        snooze_endtime?: number;
      };
      return { ok: res.ok ?? false, nextDndEndTs: res.snooze_endtime };
    } catch (err) {
      console.error("setFocusDnd failed", err);
      return { ok: false };
    }
  }

  async setFocusStatus(opts: {
    statusText: string;
    statusEmoji?: string;
    expirationTs?: number;
  }): Promise<SetFocusStatusResult> {
    try {
      const res = await this.userWeb.users.profile.set({
        profile: {
          status_text: opts.statusText,
          status_emoji: opts.statusEmoji ?? "🎯",
          status_expiration: opts.expirationTs ?? 0,
        },
      });
      return { ok: res.ok ?? false };
    } catch (err) {
      console.error("setFocusStatus failed", err);
      return { ok: false };
    }
  }

  async scheduleDigest(opts: { userId: string; postAtTs: number; text: string }): Promise<ScheduleDigestResult> {
    if (!this.botWeb) return { ok: false };
    try {
      const im = await this.botWeb.conversations.open({ users: opts.userId });
      const channel = im.channel?.id;
      if (!channel) return { ok: false };
      const res = await this.botWeb.chat.scheduleMessage({
        channel,
        post_at: opts.postAtTs,
        text: opts.text,
      });
      return { ok: res.ok ?? false, scheduledMessageId: res.scheduled_message_id };
    } catch (err) {
      console.error("scheduleDigest failed", err);
      return { ok: false };
    }
  }

  // ── v2.0 native surfaces ───────────────────────────────────────────────────
  // These use the generic `apiCall` escape hatch (like rts/live.ts) for Web API
  // methods `@slack/web-api` has no typed helper for. They are the user's own
  // canvas/list/reminders (user token, canvases:write / lists:write /
  // reminders:write) and an app-owned channel bookmark (bot token,
  // bookmarks:write). Shapes are aligned to the published method references
  // (canvases.create/edit `document_content`+`replace`, reminders.add
  // `text`/`time`, bookmarks.add `type:"link"`+`link`). Slack Lists is the one
  // still to confirm live (see syncListItems); cut line TEMPO_LISTS=off.

  async upsertCanvas(opts: { canvasId?: string; title: string; markdown: string }): Promise<UpsertCanvasResult> {
    try {
      const content = { type: "markdown", markdown: opts.markdown };
      if (opts.canvasId) {
        const res = (await this.userWeb.apiCall("canvases.edit", {
          canvas_id: opts.canvasId,
          changes: [{ operation: "replace", document_content: content }],
        })) as { ok?: boolean };
        return { ok: res.ok ?? false, canvasId: opts.canvasId };
      }
      const res = (await this.userWeb.apiCall("canvases.create", {
        title: opts.title,
        document_content: content,
      })) as { ok?: boolean; canvas_id?: string };
      return { ok: res.ok ?? false, canvasId: res.canvas_id };
    } catch (err) {
      console.error("upsertCanvas failed", err);
      return { ok: false };
    }
  }

  async syncListItems(opts: { listId?: string; title: string; items: ListItem[] }): Promise<SyncListResult> {
    // Slack Lists two-step (docs.slack.dev/reference/methods/slackLists.*):
    // `slackLists.create` takes `name` (not `title`) + a `schema` of columns
    // `{key,name,type}` and returns `list_id` + `list_metadata.schema[]` where
    // each column carries its generated `id` ("Col…"). `slackLists.items.create`
    // then references those column ids: each field is `{column_id, <type_key>:v}`
    // (text columns use the `rich_text` value key). We keep a key→column_id map
    // from the create response so items point at real columns. UNVERIFIED LIVE
    // SEAM — the `rich_text` value encoding (string vs rich-text block) is the
    // one thing to confirm with `TEMPO_SLACK_ACTIONS=live`; cut line TEMPO_LISTS=off.
    try {
      let listId = opts.listId;
      let columnIds = new Map<string, string>();
      if (!listId) {
        const created = (await this.userWeb.apiCall("slackLists.create", {
          name: opts.title,
          schema: LIST_SCHEMA,
        })) as { ok?: boolean; list_id?: string; list_metadata?: { schema?: { id?: string; key?: string }[] } };
        if (!created.ok || !created.list_id) return { ok: false };
        listId = created.list_id;
        columnIds = mapColumns(created.list_metadata?.schema);
      }
      let itemsWritten = 0;
      for (const item of opts.items) {
        // Derived commitment facts only — no source message text (Invariant 1).
        const values: Record<string, string> = {
          what: item.what,
          counterparty: item.counterparty,
          direction: item.direction,
          status: item.status,
          due: item.dueText ?? "",
          permalink: item.permalink,
        };
        const r = (await this.userWeb.apiCall("slackLists.items.create", {
          list_id: listId,
          initial_fields: listFields(values, columnIds),
        })) as { ok?: boolean };
        if (r.ok) itemsWritten++;
      }
      return { ok: true, listId, itemsWritten };
    } catch (err) {
      console.error("syncListItems failed", err);
      return { ok: false };
    }
  }

  async addReminder(opts: { text: string; time: number }): Promise<AddReminderResult> {
    try {
      const res = (await this.userWeb.apiCall("reminders.add", {
        text: opts.text,
        time: opts.time,
      })) as { ok?: boolean; reminder?: { id?: string } };
      return { ok: res.ok ?? false, reminderId: res.reminder?.id };
    } catch (err) {
      console.error("addReminder failed", err);
      return { ok: false };
    }
  }

  async addBookmark(opts: { channelId: string; title: string; link: string }): Promise<AddBookmarkResult> {
    const web = this.botWeb ?? this.userWeb;
    try {
      const res = (await web.apiCall("bookmarks.add", {
        channel_id: opts.channelId,
        title: opts.title,
        type: "link",
        link: opts.link,
      })) as { ok?: boolean; bookmark?: { id?: string } };
      return { ok: res.ok ?? false, bookmarkId: res.bookmark?.id };
    } catch (err) {
      console.error("addBookmark failed", err);
      return { ok: false };
    }
  }
}

// ── Slack Lists schema/field helpers ─────────────────────────────────────────

/** The Commitment-Ledger columns, all plain text; `what` is the primary column. */
const LIST_SCHEMA = [
  { key: "what", name: "What", type: "text", is_primary_column: true },
  { key: "counterparty", name: "Who", type: "text" },
  { key: "direction", name: "Direction", type: "text" },
  { key: "status", name: "Status", type: "text" },
  { key: "due", name: "Due", type: "text" },
  { key: "permalink", name: "Link", type: "text" },
] as const;

/** key → generated column id ("Col…") from the create response's schema. */
function mapColumns(schema?: { id?: string; key?: string }[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of schema ?? []) if (c.key && c.id) m.set(c.key, c.id);
  return m;
}

/**
 * Build `initial_fields` for one row. When we know the column ids, address them
 * by `column_id`; otherwise fall back to `key` (best-effort so a partial schema
 * response still writes something rather than throwing). Text columns take a
 * `rich_text` value.
 */
function listFields(values: Record<string, string>, columnIds: Map<string, string>): Record<string, unknown>[] {
  return Object.entries(values).map(([key, value]) => {
    const columnId = columnIds.get(key);
    return columnId ? { column_id: columnId, rich_text: value } : { key, rich_text: value };
  });
}
