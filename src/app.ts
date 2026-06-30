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

import { App, Assistant, ExpressReceiver, LogLevel } from "@slack/bolt";
import { config, assertSlackRuntime } from "./config.js";
import { buildContext } from "./agent/context.js";
import { respond as tempoRespond, routeIntent, triageAll } from "./agent/orchestrator.js";
import { draftReply, draftNudge, draftRenegotiation } from "./modules/draft.js";
import { homeDashboardBlocks, settingsModalView, type SettingsModalPrefs } from "./blocks/index.js";
import { getUserToken } from "./db/tokens.js";
import { snoozeItem, markItemDone } from "./db/snoozes.js";
import { getCommitmentByPermalink, markRenegotiating, markNudged } from "./db/commitments.js";
import { getPrefs, savePrefs } from "./db/prefs.js";
import { resolveA11yPrefs } from "./a11y/index.js";

type BoltApp = InstanceType<typeof App>;

/** How long a manual snooze hides a triage item before it resurfaces. */
const DEFAULT_SNOOZE_SECS = 4 * 3600;

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
    const userId = (event as any).user ?? "U_SAM";
    const ctx = contextFor(userId);
    // Triage + commitments are pure reads (RTS search + the local stores) —
    // safe to recompute on every Home open. Focus is deliberately NOT live
    // here: planning a focus block has real side effects (MCP + Slack
    // DND/status), and opening a tab must never act on the user's behalf.
    const [triage, commitments] = await Promise.all([
      tempoRespond(ctx, "what needs me today?"),
      tempoRespond(ctx, "show my commitments"),
    ]);
    await client.views.publish({
      user_id: userId,
      view: {
        type: "home",
        blocks: homeDashboardBlocks({ triage: triage.blocks, commitments: commitments.blocks }) as any,
      },
    });
  });

  app.action("open_settings", async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any)?.user?.id ?? "U_SAM";
    const triggerId = (body as any)?.trigger_id;
    if (!triggerId) return;
    const stored = getPrefs(userId);
    const a11y = resolveA11yPrefs(stored);
    const view = settingsModalView({ ...a11y, focusDefaultMins: stored?.focusDefaultMins });
    await client.views.open({ trigger_id: triggerId, view });
  });

  app.view("settings_modal", async ({ ack, body, view }) => {
    await ack();
    const userId = (body as any)?.user?.id ?? "U_SAM";
    savePrefs(userId, parseSettingsSubmission(view));
  });

  app.action("show_rest", async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any)?.user?.id ?? "U_SAM";
    const res = await triageAll(contextFor(userId));
    await ephemeral(client, body, res.text, res.blocks as any);
  });

  app.action("draft_reply", async ({ ack, body, client }) => {
    await ack();
    await postDraft(client, body);
  });
  app.action("draft_deliverable", async ({ ack, body, client }) => {
    await ack();
    await postDraft(client, body);
  });

  app.action("snooze", async ({ ack, body, client }) => {
    await ack();
    const { permalink, userId } = actionTarget(body);
    if (permalink) snoozeItem(userId, permalink, Math.floor(Date.now() / 1000) + DEFAULT_SNOOZE_SECS);
    await ephemeral(client, body, confirmation("snooze"));
  });

  app.action("mark_done", async ({ ack, body, client }) => {
    await ack();
    const { permalink, userId } = actionTarget(body);
    if (permalink) markItemDone(userId, permalink);
    await ephemeral(client, body, confirmation("mark_done"));
  });

  app.action("nudge", async ({ ack, body, client }) => {
    await ack();
    const { permalink, userId } = actionTarget(body);
    const c = permalink ? getCommitmentByPermalink(userId, permalink) : undefined;
    if (!c) {
      await ephemeral(client, body, "I don't have that one cached anymore — run `/tempo commitments` again and try once more.");
      return;
    }
    markNudged(userId, permalink);
    const draft = await draftNudge(c);
    await postComposedDraft(client, body, draft);
  });

  app.action("renegotiate", async ({ ack, body, client }) => {
    await ack();
    const { permalink, userId } = actionTarget(body);
    const c = permalink ? getCommitmentByPermalink(userId, permalink) : undefined;
    if (!c) {
      await ephemeral(client, body, "I don't have that one cached anymore — run `/tempo commitments` again and try once more.");
      return;
    }
    markRenegotiating(userId, permalink);
    const draft = await draftRenegotiation(c);
    await postComposedDraft(client, body, draft);
  });

  for (const id of ["use_rewrite", "keep_draft"]) {
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
    use_rewrite: "Using the rewrite. Review it and send when ready.",
    keep_draft: "Keeping your version.",
  };
  return map[actionId] ?? "Done.";
}

/** The permalink + acting user for a button click — both snooze/done and the
 * commitment actions key off this, since every actionable card item carries
 * its permalink as the button value. */
function actionTarget(body: any): { permalink: string; userId: string } {
  return {
    permalink: body?.actions?.[0]?.value ?? "",
    userId: body?.user?.id ?? "U_SAM",
  };
}

async function postDraft(client: any, body: any) {
  const { permalink, userId } = actionTarget(body);
  const ctx = contextFor(userId);
  const source = await sourceTextFor(ctx, permalink);
  const draft = await draftReply(source ?? "");
  await postComposedDraft(client, body, draft);
}

async function postComposedDraft(client: any, body: any, draft: string) {
  const channel: string | undefined = body?.channel?.id ?? body?.container?.channel_id;
  const threadTs: string | undefined = body?.message?.thread_ts ?? body?.message?.ts;
  const userId: string = body?.user?.id ?? "U_SAM";
  const text = `Here's a draft — *review and send it yourself* (I won't post it for you):\n>>> ${draft}`;
  if (channel) {
    await client.chat.postMessage({ channel, thread_ts: threadTs, text });
    return;
  }
  // No channel in context (e.g. the button was clicked from App Home, which
  // has no channel) — fall back to DMing the user directly.
  await dm(client, userId, text);
}

async function sourceTextFor(ctx: ReturnType<typeof buildContext>, permalink: string): Promise<string | undefined> {
  if (!permalink) return undefined;
  const res = await ctx.rts.search({ query: "recent messages", limit: 50 });
  return res.messages.find((m) => m.permalink === permalink)?.text;
}

async function ephemeral(client: any, body: any, text: string, blocks?: any[]) {
  const channel = body?.channel?.id ?? body?.container?.channel_id;
  const user = body?.user?.id;
  if (channel && user) {
    await client.chat.postEphemeral({ channel, user, text, ...(blocks ? { blocks } : {}) });
    return;
  }
  // Ephemeral messages require a channel, which App Home doesn't have — DM instead.
  if (user) await dm(client, user, text, blocks);
}

async function dm(client: any, userId: string, text: string, blocks?: any[]) {
  const im = await client.conversations.open({ users: userId });
  const channel = im?.channel?.id;
  if (channel) await client.chat.postMessage({ channel, text, ...(blocks ? { blocks } : {}) });
}

function parseSettingsSubmission(view: any): Partial<SettingsModalPrefs> {
  const values = view?.state?.values ?? {};
  const verbosity = values.verbosity?.value?.selected_option?.value as SettingsModalPrefs["verbosity"] | undefined;
  const readingLevel = values.reading_level?.value?.selected_option?.value as SettingsModalPrefs["readingLevel"] | undefined;
  const maxItemsRaw = values.max_items?.value?.selected_option?.value;
  const focusMinsRaw = values.focus_default_mins?.value?.value;
  const readAloud = (values.read_aloud?.value?.selected_options ?? []).length > 0;

  return {
    ...(verbosity ? { verbosity } : {}),
    ...(readingLevel ? { readingLevel } : {}),
    ...(maxItemsRaw ? { maxItems: Number(maxItemsRaw) } : {}),
    focusDefaultMins: focusMinsRaw ? Number(focusMinsRaw) : undefined,
    readAloud,
  };
}

export { routeIntent };
