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
  // canvas/list/reminders (user token, canvases:write / reminders:write) and an
  // app-owned channel bookmark (bot token, bookmarks:write). UNVERIFIED LIVE
  // SEAM: contract-tested against a mocked WebClient only — same posture as the
  // rest of live.ts / LiveRtsClient (never run against a real workspace yet).

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
    try {
      let listId = opts.listId;
      if (!listId) {
        const created = (await this.userWeb.apiCall("slackLists.create", {
          title: opts.title,
        })) as { ok?: boolean; list_id?: string };
        if (!created.ok || !created.list_id) return { ok: false };
        listId = created.list_id;
      }
      let itemsWritten = 0;
      for (const item of opts.items) {
        const r = (await this.userWeb.apiCall("slackLists.items.create", {
          list_id: listId,
          // Derived commitment facts only — no source message text.
          initial_fields: [
            { key: "what", text: item.what },
            { key: "counterparty", text: item.counterparty },
            { key: "direction", text: item.direction },
            { key: "status", text: item.status },
            { key: "due", text: item.dueText ?? "" },
            { key: "permalink", text: item.permalink },
          ],
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
