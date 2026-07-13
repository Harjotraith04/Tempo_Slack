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
import { config, flags, assertVercelRuntime } from "../../src/config.js";
import { buildUserContext } from "../../src/application/context.js";
import { respond } from "../../src/application/orchestrator.js";
import { updateCanvas, atRiskCommitments } from "../../src/application/use-cases/surfaces.js";
import { buildProactiveBlocks } from "../../src/application/use-cases/proactive.js";
import { droppedBallBlocks } from "../../src/platform/slack/blockkit/index.js";
import { SUBJECT_USER_ID } from "../../src/platform/slack/rts/fixtures.js";
import { getStore } from "../../src/platform/persistence/index.js";

interface DigestTarget {
  userId: string;
  token: string | undefined;
}

async function targets(): Promise<DigestTarget[]> {
  const store = getStore();
  const installed = await store.tokens.list();
  if (installed.length) {
    return Promise.all(
      installed.map(async (u) => ({ userId: u.userId, token: await store.tokens.get(u.userId) })),
    );
  }
  return config.slack.userToken ? [{ userId: SUBJECT_USER_ID, token: config.slack.userToken }] : [];
}

async function sendDigest(userId: string, token: string | undefined): Promise<void> {
  // Through the shared chokepoint, so the digest honours the user's consent scope.
  // It previously called buildContext() directly and passed no scope — meaning the
  // one unattended surface was the one that DM'd people content from channels they
  // had explicitly told Tempo not to read.
  const ctx = await buildUserContext({
    subjectUserId: userId,
    client: new WebClient(config.slack.botToken),
  });
  const digest = await respond(ctx, "what needs me today?");

  // Keep the user's living Tempo Canvas in step with the morning digest —
  // their own scheduled cron, updating their own private canvas. Best-effort:
  // a canvas hiccup must never block the digest DM.
  if (flags.canvas) {
    try {
      await updateCanvas(ctx);
    } catch (err) {
      console.error(`canvas refresh failed for ${userId}`, err);
    }
  }

  // Proactive dropped-ball nudge: gently flag commitments that are slipping.
  // Best-effort — a hiccup here must never block the digest DM.
  let droppedBall: any[] = [];
  try {
    droppedBall = droppedBallBlocks(await atRiskCommitments(ctx));
  } catch (err) {
    console.error(`dropped-ball check failed for ${userId}`, err);
  }

  // Proactive intelligence (opt-in): an overload heads-up + batched FYIs, folded
  // into this one calm touchpoint. Off unless TEMPO_PROACTIVE is enabled.
  let proactive: any[] = [];
  if (flags.proactive) {
    try {
      proactive = await buildProactiveBlocks(ctx);
    } catch (err) {
      console.error(`proactive check failed for ${userId}`, err);
    }
  }

  if (config.slack.botToken && token) {
    const web = new WebClient(config.slack.botToken);
    const im = await web.conversations.open({ users: userId });
    const channel = im.channel?.id;
    if (channel) {
      await web.chat.postMessage({
        channel,
        text: `Good morning — ${digest.text}`,
        blocks: [...(digest.blocks as any[]), ...droppedBall, ...proactive] as any,
      });
    }
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  assertVercelRuntime();
  // Optional shared-secret check for the cron.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers["authorization"] !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.end("unauthorized");
    return;
  }

  const list = await targets();
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
