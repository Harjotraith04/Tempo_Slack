/**
 * Bolt app wiring — Tempo's Slack surfaces.
 *
 *  - Assistant pane: greeting + suggested prompts on open; routes each user
 *    message through the orchestrator.
 *  - /tempo slash command: triage | commitments | catchup | focus | decode.
 *  - app_home_opened: publishes the Home dashboard.
 *  - Button actions: "Draft a reply" generates a draft the user reviews and
 *    sends themselves (Tempo never auto-sends); others ack with a confirmation.
 *
 * The same handlers serve Socket Mode (local dev) and an Express receiver
 * (Vercel/prod) — see createApp() / createExpressApp().
 */

import boltPkg from "@slack/bolt";
import { config, assertSlackRuntime } from "./config.js";
import { buildContext } from "./agent/context.js";
import { respond as tempoRespond, routeIntent } from "./agent/orchestrator.js";
import { draftReply } from "./modules/draft.js";
import { homeBlocks } from "./blocks/index.js";
import { getUserToken } from "./db/tokens.js";

const { App, Assistant, ExpressReceiver, LogLevel } = boltPkg;
type BoltApp = InstanceType<typeof App>;

/** Prefer the user's stored OAuth token; fall back to the single demo token. */
function resolveUserToken(slackUserId: string): string | undefined {
  return getUserToken(slackUserId) ?? config.slack.userToken;
}

function contextFor(slackUserId: string) {
  return buildContext({
    subjectUserId: slackUserId,
    userToken: resolveUserToken(slackUserId),
  });
}

/** Register every Tempo handler on a Bolt app (receiver-agnostic). */
export function registerHandlers(app: BoltApp) {
  const assistant = new Assistant({
    threadStarted: async ({ say, setSuggestedPrompts }) => {
      await say(
        "Hi — I'm Tempo, your working memory for Slack. I'll only ever surface what actually needs you, and I never act without your tap. What would help right now?",
      );
      await setSuggestedPrompts({
        title: "Start here",
        prompts: [
          { title: "What needs me today?", message: "What needs me today?" },
          { title: "What did I promise?", message: "Show my open commitments." },
          { title: "Catch me up", message: "Catch me up on what I missed while I was away." },
        ],
      });
    },
    userMessage: async ({ message, say, setStatus }) => {
      const text = (message as any).text ?? "";
      const userId = (message as any).user ?? "U_SAM";
      await setStatus("is thinking…");
      try {
        const res = await tempoRespond(contextFor(userId), text);
        await say({ text: res.text, blocks: res.blocks as any });
      } catch (err) {
        console.error("userMessage error", err);
        await say("Sorry — I hit a snag pulling that together. Try again in a moment.");
      }
    },
  });
  app.assistant(assistant);

  app.command("/tempo", async ({ command, ack, respond }) => {
    await ack();
    const text = command.text?.trim() || "triage";
    const res = await tempoRespond(contextFor(command.user_id), text);
    await respond({ response_type: "ephemeral", text: res.text, blocks: res.blocks as any });
  });

  app.event("app_mention", async ({ event, say }) => {
    const res = await tempoRespond(contextFor((event as any).user ?? "U_SAM"), (event as any).text ?? "triage");
    await say({ text: res.text, blocks: res.blocks as any, thread_ts: (event as any).ts });
  });

  app.event("app_home_opened", async ({ event, client }) => {
    await client.views.publish({
      user_id: (event as any).user,
      view: { type: "home", blocks: homeBlocks() as any },
    });
  });

  app.action("draft_reply", async ({ ack, body, client }) => {
    await ack();
    await postDraft(client, body);
  });
  app.action("draft_deliverable", async ({ ack, body, client }) => {
    await ack();
    await postDraft(client, body);
  });
  for (const id of ["snooze", "mark_done", "nudge", "renegotiate", "use_rewrite", "keep_draft"]) {
    app.action(id, async ({ ack, body, client }) => {
      await ack();
      await ephemeral(client, body, confirmation(id));
    });
  }
  app.action("open_link", async ({ ack }) => {
    await ack();
  });

  return app;
}

export function createApp(): BoltApp {
  assertSlackRuntime();
  const app = new App({
    token: config.slack.botToken,
    signingSecret: config.slack.signingSecret,
    appToken: config.slack.appToken,
    socketMode: config.runtime.receiver === "socket",
    logLevel: LogLevel.INFO,
  });
  return registerHandlers(app);
}

/** HTTP receiver for Vercel/prod. Returns the Express app to export as handler. */
export function createExpressApp() {
  const receiver = new ExpressReceiver({
    signingSecret: config.slack.signingSecret ?? "",
    processBeforeResponse: true,
  });
  const app = new App({ token: config.slack.botToken, receiver });
  registerHandlers(app);
  return receiver.app;
}

function confirmation(actionId: string): string {
  const map: Record<string, string> = {
    snooze: "Snoozed — I'll resurface it later.",
    mark_done: "Marked done. Nice.",
    nudge: "I'll send a gentle nudge.",
    renegotiate: "I can draft a message to push the deadline — just say so.",
    use_rewrite: "Using the rewrite. Review it and send when ready.",
    keep_draft: "Keeping your version.",
  };
  return map[actionId] ?? "Done.";
}

async function postDraft(client: any, body: any) {
  const permalink: string = body?.actions?.[0]?.value ?? "";
  const userId: string = body?.user?.id ?? "U_SAM";
  const channel: string | undefined = body?.channel?.id ?? body?.container?.channel_id;
  const threadTs: string | undefined = body?.message?.thread_ts ?? body?.message?.ts;

  const ctx = contextFor(userId);
  const source = await sourceTextFor(ctx, permalink);
  const draft = await draftReply(source ?? "");

  const text = `Here's a draft — *review and send it yourself* (I won't post it for you):\n>>> ${draft}`;
  if (channel) await client.chat.postMessage({ channel, thread_ts: threadTs, text });
}

async function sourceTextFor(ctx: ReturnType<typeof buildContext>, permalink: string): Promise<string | undefined> {
  if (!permalink) return undefined;
  const res = await ctx.rts.search({ query: "recent messages", limit: 50 });
  return res.messages.find((m) => m.permalink === permalink)?.text;
}

async function ephemeral(client: any, body: any, text: string) {
  const channel = body?.channel?.id ?? body?.container?.channel_id;
  const user = body?.user?.id;
  if (channel && user) await client.chat.postEphemeral({ channel, user, text });
}

export { routeIntent };
