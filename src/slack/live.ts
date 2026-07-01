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
import { webClientOptions } from "../shared/webClientOptions.js";
import type {
  ScheduleDigestResult,
  SetFocusDndResult,
  SetFocusStatusResult,
  SlackActionsClient,
} from "./types.js";

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
}
