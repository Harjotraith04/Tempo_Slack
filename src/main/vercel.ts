/**
 * Vercel composition root — Bolt on Fluid Compute via `@vercel/slack-bolt`.
 *
 * Why not the ExpressReceiver here: Slack requires events to be acknowledged
 * within 3 seconds, and Tempo's handlers do real RTS + LLM work. The
 * VercelReceiver acks immediately and continues processing in the background
 * with `waitUntil`, so a cold start or a slow model call never triggers
 * Slack's retry storm. It also owns request-signature verification.
 *
 * This file is the ONLY place that touches `@vercel/slack-bolt`, mirroring the
 * SDK-isolation discipline of platform/mcp/connect.ts and pg/connect.ts — the
 * zero-credential demo/tests never load it.
 */

import { App } from "@slack/bolt";
import { VercelReceiver, createHandler, type VercelHandler } from "@vercel/slack-bolt";
import { config, assertVercelRuntime } from "../config.js";
import { webClientOptions } from "../shared/webClientOptions.js";
import { registerHandlers } from "./app.js";

/** Build the web-standard `(Request) => Promise<Response>` handler Vercel serves. */
export function createVercelHandler(): VercelHandler {
  assertVercelRuntime();
  if (!config.slack.signingSecret) {
    throw new Error("SLACK_SIGNING_SECRET is required to serve Slack events. See .env.example.");
  }
  if (!config.slack.botToken) {
    throw new Error("SLACK_BOT_TOKEN is required to serve Slack events. See .env.example.");
  }
  const receiver = new VercelReceiver({ signingSecret: config.slack.signingSecret });
  const app = new App({
    token: config.slack.botToken,
    signingSecret: config.slack.signingSecret,
    receiver,
    clientOptions: webClientOptions,
    // REQUIRED by @vercel/slack-bolt: createHandler() calls app.init() itself.
    // Without deferInitialization, Bolt has already run its auth setup in the
    // constructor and that second init() re-checks a token it no longer holds —
    // every request dies with AppInitializationError ("no token or authorize").
    deferInitialization: true,
  });
  registerHandlers(app);
  return createHandler(app, receiver);
}
