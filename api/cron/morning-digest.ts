/**
 * Scheduled morning triage (Vercel Cron).
 *
 * This is the proof of the user-token architecture: because Tempo searches with
 * a USER token, RTS needs no `action_token` from a live interaction — so a
 * background cron can run a real triage and DM the calm digest. With a bot token
 * this would be impossible (no action_token outside a user event).
 *
 * Iterates every installed user from the token store, running each digest
 * independently — one user's invalid/expired token (or any other failure)
 * must not stop the others' digests or 500 the whole cron run. Sequential by
 * design (not Promise.all): hackathon-scale user counts, and it's easy on
 * Slack rate limits. Falls back to the single configured demo user when the
 * store is empty, preserving today's local-dev behavior unchanged.
 *
 * Configure the schedule in vercel.json. Secure with CRON_SECRET in prod.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { WebClient } from "@slack/web-api";
import { config } from "../../src/config.js";
import { buildContext } from "../../src/agent/context.js";
import { respond } from "../../src/agent/orchestrator.js";
import { SUBJECT_USER_ID } from "../../src/rts/fixtures.js";
import { listInstalledUsers, getUserToken } from "../../src/db/tokens.js";

interface DigestTarget {
  userId: string;
  token: string | undefined;
}

function targets(): DigestTarget[] {
  const installed = listInstalledUsers();
  if (installed.length) {
    return installed.map((u) => ({ userId: u.userId, token: getUserToken(u.userId) }));
  }
  return config.slack.userToken ? [{ userId: SUBJECT_USER_ID, token: config.slack.userToken }] : [];
}

async function sendDigest(userId: string, token: string | undefined): Promise<void> {
  const ctx = buildContext({ subjectUserId: userId, userToken: token });
  const digest = await respond(ctx, "what needs me today?");

  if (config.slack.botToken && token) {
    const web = new WebClient(config.slack.botToken);
    const im = await web.conversations.open({ users: userId });
    const channel = im.channel?.id;
    if (channel) {
      await web.chat.postMessage({
        channel,
        text: `Good morning — ${digest.text}`,
        blocks: digest.blocks as any,
      });
    }
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Optional shared-secret check for the cron.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers["authorization"] !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.end("unauthorized");
    return;
  }

  const list = targets();
  let succeeded = 0;
  let failed = 0;

  for (const { userId, token } of list) {
    try {
      await sendDigest(userId, token);
      succeeded++;
    } catch (err) {
      console.error(`morning-digest failed for ${userId}`, err);
      failed++;
    }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, users: list.length, succeeded, failed }));
}
