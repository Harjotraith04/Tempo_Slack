/**
 * Scheduled morning triage (Vercel Cron).
 *
 * This is the proof of the user-token architecture: because Tempo searches with
 * a USER token, RTS needs no `action_token` from a live interaction — so a
 * background cron can run a real triage and DM the calm digest. With a bot token
 * this would be impossible (no action_token outside a user event).
 *
 * Configure the schedule in vercel.json. Secure with CRON_SECRET in prod.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { WebClient } from "@slack/web-api";
import { config } from "../../src/config.js";
import { buildContext } from "../../src/agent/context.js";
import { respond } from "../../src/agent/orchestrator.js";
import { SUBJECT_USER_ID } from "../../src/rts/fixtures.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Optional shared-secret check for the cron.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers["authorization"] !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.end("unauthorized");
    return;
  }

  try {
    // In production, iterate installed users from the token store. For the demo,
    // run the single configured user ("Sam").
    const userId = SUBJECT_USER_ID;
    const ctx = buildContext({ subjectUserId: userId, userToken: config.slack.userToken });
    const digest = await respond(ctx, "what needs me today?");

    if (config.slack.botToken && config.slack.userToken) {
      const web = new WebClient(config.slack.botToken);
      // Open a DM to the user and post the digest.
      const im = await web.conversations.open({ users: userId });
      const channel = (im as any).channel?.id;
      if (channel) {
        await web.chat.postMessage({
          channel,
          text: `Good morning — ${digest.text}`,
          blocks: digest.blocks as any,
        });
      }
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, summary: digest.text }));
  } catch (err) {
    console.error("morning-digest error", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false }));
  }
}
