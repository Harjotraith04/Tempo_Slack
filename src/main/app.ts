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
import { config, flags, assertSlackRuntime, assertSecretsHardened } from "../config.js";
import { webClientOptions } from "../shared/webClientOptions.js";
import { withTimeout } from "../shared/timeout.js";
import { buildContext } from "../application/context.js";
import { createContainer } from "../application/container.js";
import { respond as tempoRespond, routeIntent, triageAll } from "../application/orchestrator.js";
import { updateCanvas, syncCommitmentsToList, remindAboutCommitment } from "../application/use-cases/surfaces.js";
import { registerWorkflowSteps } from "../platform/slack/inbound/workflow-steps.js";
import { draftReply, draftNudge, draftRenegotiation } from "../modules/draft.js";
import { homeDashboardBlocks, onboardingBlocks, settingsModalView, errorBlocks, type SettingsModalPrefs } from "../platform/slack/blockkit/index.js";
import { getStore } from "../platform/persistence/index.js";
import { resolveA11yPrefs } from "../accessibility/index.js";
import { getTtsClient } from "../accessibility/tts/index.js";
import { isFirstRun, welcomeMessage } from "../modules/onboarding.js";
import { CORPUS_QUERY } from "../ports/rts.js";
import { resolveDisplayName } from "../platform/slack/webapi/displayName.js";

type BoltApp = InstanceType<typeof App>;

/** How long a manual snooze hides a triage item before it resurfaces. */
const DEFAULT_SNOOZE_SECS = 4 * 3600;

/** Calm, honest failure copy — reassures the user nothing was changed. */
const SNAG = "I hit a snag — nothing was changed. Try again in a moment.";

/** The first thing the user sees, within ~1s of hitting enter. */
const THINKING = "_Reading your Slack…_";

/**
 * Ceiling on one orchestrator turn. Well above the ~10s a live triage takes and
 * well under the function's own limit, so the user gets SNAG instead of silence.
 */
const RESPOND_TIMEOUT_MS = 45_000;

/** Marks an error whose user-facing message has already been delivered, so
 * `safely()` doesn't post a second apology on top of it. */
class AlreadyToldTheUser extends Error {
  constructor(readonly reason: unknown) {
    super("already reported to the user");
    this.name = "AlreadyToldTheUser";
  }
}

/**
 * Runs a handler's post-ack work, and on failure logs it and runs an optional
 * recovery (e.g. a calm ephemeral) — a thrown error must never crash a Slack
 * handler or leave the user staring at a dead button. Mirrors the try/catch the
 * Assistant `userMessage` handler already uses.
 */
export async function safely(
  label: string,
  work: () => Promise<unknown>,
  recover?: () => Promise<unknown>,
): Promise<void> {
  try {
    await work();
  } catch (err) {
    // The placeholder path already rewrote its own message to SNAG. Running
    // `recover` here would apologise twice.
    if (err instanceof AlreadyToldTheUser) {
      console.error(`${label} error`, err.reason);
      return;
    }
    console.error(`${label} error`, err);
    if (recover) {
      try {
        await recover();
      } catch (e) {
        console.error(`${label} recovery failed`, e);
      }
    }
  }
}

/**
 * Post a placeholder immediately, do the slow work, then EDIT the placeholder
 * into the real answer.
 *
 * A live triage is an RTS + LLM round-trip, and Slack shows no typing indicator
 * for a bot posting into a DM — so without this the user stares at nothing and
 * concludes the app is broken. (The Assistant pane has `setStatus` for exactly
 * this, but the Agent experience delivers DMs as plain `message.im`, which that
 * middleware never sees — so this path had no affordance at all.)
 *
 * The one unacceptable outcome is a message left reading "Reading your Slack…"
 * forever, so every failure path is covered:
 *   - placeholder fails to post → just post the answer as a new message
 *   - chat.update fails         → post the answer as a new message
 *   - the work throws           → rewrite the placeholder to SNAG, then signal
 *                                 that the user has already been told
 */
async function replyWithPlaceholder<T extends { text: string; blocks: unknown[] }>(
  client: any,
  say: any,
  work: () => Promise<T>,
  opts: { threadTs?: string } = {},
): Promise<T> {
  const thread = opts.threadTs ? { thread_ts: opts.threadTs } : {};
  let channel: string | undefined;
  let ts: string | undefined;
  try {
    const ph = (await say({ text: THINKING, ...thread })) as
      | { channel?: string; ts?: string }
      | undefined;
    channel = ph?.channel;
    ts = ph?.ts;
  } catch (err) {
    // A failed placeholder must never cost the user their answer.
    console.error("placeholder post failed", err);
  }

  let res: T;
  try {
    res = await work();
  } catch (err) {
    if (channel && ts) {
      await client.chat
        .update({ channel, ts, text: SNAG, blocks: [] })
        .catch((e: unknown) => console.error("placeholder error-update failed", e));
      throw new AlreadyToldTheUser(err);
    }
    throw err;
  }

  if (channel && ts) {
    try {
      await client.chat.update({ channel, ts, text: res.text, blocks: res.blocks as any });
      return res;
    } catch (err) {
      console.error("chat.update failed; falling back to a new message", err);
    }
  }
  await say({ text: res.text, blocks: res.blocks as any, ...thread });
  return res;
}

/** Prefer the user's stored OAuth token; fall back to the single demo token. */
async function resolveUserToken(slackUserId: string): Promise<string | undefined> {
  return (await getStore().tokens.get(slackUserId)) ?? config.slack.userToken;
}

/** Composition root for the inbound layer — one container shared by every
 * handler; each per-user context reuses it (see contextFor). */
const container = createContainer();

async function contextFor(client: any, slackUserId: string) {
  return buildContext({
    subjectUserId: slackUserId,
    subjectName: await resolveDisplayName(client, slackUserId),
    userToken: await resolveUserToken(slackUserId),
    container,
  });
}

/** Publishes the App Home tab: live triage + commitments, reusing the same
 * respond() path the Assistant pane / `/tempo` use, optionally prefixed with
 * the first-run onboarding banner. Triage + commitments are pure reads —
 * safe to recompute on every Home open. Focus is deliberately NOT live here:
 * planning a focus block has real side effects (MCP + Slack DND/status), and
 * opening a tab must never act on the user's behalf. */
async function publishHome(client: any, userId: string, opts: { showOnboarding?: boolean } = {}) {
  try {
    const ctx = await contextFor(client, userId);
    // Passive refresh on tab open — don't count it toward the user's KPIs.
    const [triage, commitments, metrics] = await Promise.all([
      tempoRespond(ctx, "what needs me today?", { record: false }),
      tempoRespond(ctx, "show my commitments", { record: false }),
      getStore().metrics.get(userId),
    ]);
    await client.views.publish({
      user_id: userId,
      view: {
        type: "home",
        blocks: [
          ...(opts.showOnboarding ? onboardingBlocks() : []),
          ...homeDashboardBlocks({
            triage: triage.blocks,
            commitments: commitments.blocks,
            metrics,
            surfaces: { canvas: flags.canvas, lists: flags.lists },
          }),
        ] as any,
      },
    });
  } catch (err) {
    // A blank Home tab reads as "broken"; publish a calm fallback instead.
    console.error("publishHome error", err);
    await client.views.publish({
      user_id: userId,
      view: { type: "home", blocks: errorBlocks() as any },
    });
  }
}

/** Register every Tempo handler on a Bolt app (receiver-agnostic). */
export function registerHandlers(app: BoltApp) {
  const assistant = new Assistant({
    threadStarted: async ({ event, say, setSuggestedPrompts }) => {
      const userId = event.assistant_thread?.user_id ?? "U_SAM";
      const welcome = welcomeMessage(isFirstRun(await getStore().prefs.get(userId)));
      await say(welcome.text);
      await setSuggestedPrompts({ title: "Start here", prompts: welcome.prompts });
    },
    userMessage: async ({ message, say, setStatus, client }) => {
      const text = (message as any).text ?? "";
      const userId = (message as any).user ?? "U_SAM";
      await setStatus("is thinking…");
      try {
        const res = await tempoRespond(await contextFor(client, userId), text);
        await say({ text: res.text, blocks: res.blocks as any });
        await maybeSendReadAloud(client, userId, res.speech);
      } catch (err) {
        console.error("userMessage error", err);
        await say("Sorry — I hit a snag pulling that together. Try again in a moment.");
      }
    },
  });
  app.assistant(assistant);

  // The 2026 Agent experience (manifest `agent_view`) delivers a user's agent
  // DMs as plain `message.im` events. The Assistant middleware above only
  // intercepts *threaded* IM messages (the legacy assistant container) and
  // stops their propagation, so this listener sees exactly the messages it
  // doesn't: top-level human DMs. Between the two, both experiences are served
  // without ever double-replying.
  app.message(async ({ message, say, client }) => {
    const m = message as any;
    if (m.channel_type !== "im" || m.thread_ts || m.subtype || m.bot_id || !m.text) return;
    const userId = m.user ?? "U_SAM";
    await safely(
      "agent_dm",
      async () => {
        const res = await replyWithPlaceholder(client, say, async () =>
          withTimeout(
            tempoRespond(await contextFor(client, userId), m.text),
            RESPOND_TIMEOUT_MS,
            "tempoRespond(agent_dm)",
          ),
        );
        await maybeSendReadAloud(client, userId, res.speech);
      },
      () => say(SNAG),
    );
  });

  app.command("/tempo", async ({ command, ack, respond, client }) => {
    await ack();
    await safely(
      "/tempo",
      async () => {
        const text = command.text?.trim() || "triage";
        const res = await tempoRespond(await contextFor(client, command.user_id), text);
        await respond({ response_type: "ephemeral", text: res.text, blocks: res.blocks as any });
        await maybeSendReadAloud(client, command.user_id, res.speech);
      },
      () => respond({ response_type: "ephemeral", text: SNAG }),
    );
  });

  app.event("app_mention", async ({ event, say, client }) => {
    const userId = (event as any).user ?? "U_SAM";
    const threadTs = (event as any).ts;
    await safely(
      "app_mention",
      async () => {
        const res = await replyWithPlaceholder(
          client,
          say,
          async () =>
            withTimeout(
              tempoRespond(await contextFor(client, userId), (event as any).text ?? "triage"),
              RESPOND_TIMEOUT_MS,
              "tempoRespond(app_mention)",
            ),
          { threadTs },
        );
        await maybeSendReadAloud(client, userId, res.speech);
      },
      () => say({ text: SNAG, thread_ts: threadTs }),
    );
  });

  app.event("app_home_opened", async ({ event, client }) => {
    const userId = (event as any).user ?? "U_SAM";
    // publishHome has its own fallback view, so no extra recovery needed here.
    await safely("app_home_opened", async () =>
      publishHome(client, userId, { showOnboarding: isFirstRun(await getStore().prefs.get(userId)) }),
    );
  });

  app.action("complete_onboarding", async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any)?.user?.id ?? "U_SAM";
    await getStore().prefs.save(userId, { onboardedAt: Math.floor(Date.now() / 1000) });
    // Re-publish immediately so the banner disappears without requiring a
    // tab close/reopen.
    await publishHome(client, userId);
  });

  app.action("open_settings", async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any)?.user?.id ?? "U_SAM";
    const triggerId = (body as any)?.trigger_id;
    if (!triggerId) return;
    const stored = await getStore().prefs.get(userId);
    const a11y = resolveA11yPrefs(stored);
    const view = settingsModalView({ ...a11y, focusDefaultMins: stored?.focusDefaultMins });
    await client.views.open({ trigger_id: triggerId, view });
  });

  app.view("settings_modal", async ({ ack, body, view }) => {
    await ack();
    const userId = (body as any)?.user?.id ?? "U_SAM";
    await getStore().prefs.save(userId, parseSettingsSubmission(view));
  });

  app.action("show_rest", async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any)?.user?.id ?? "U_SAM";
    await safely(
      "show_rest",
      async () => {
        const res = await triageAll(await contextFor(client, userId));
        await ephemeral(client, body, res.text, res.blocks as any);
        await maybeSendReadAloud(client, userId, res.speech);
      },
      () => replyError(client, body),
    );
  });

  app.action("draft_reply", async ({ ack, body, client }) => {
    await ack();
    await safely("draft_reply", () => postDraft(client, body), () => replyError(client, body));
  });
  app.action("draft_deliverable", async ({ ack, body, client }) => {
    await ack();
    await safely("draft_deliverable", () => postDraft(client, body), () => replyError(client, body));
  });

  app.action("snooze", async ({ ack, body, client }) => {
    await ack();
    await safely("snooze", async () => {
      const { permalink, userId, authorId } = actionTarget(body);
      if (permalink) {
        await getStore().snoozes.snooze(userId, permalink, Math.floor(Date.now() / 1000) + DEFAULT_SNOOZE_SECS);
        await getStore().metrics.record(userId, { itemsRecovered: 1 });
        // Learn: pushing this sender's item away deprioritizes them.
        if (authorId) await getStore().signals.record(userId, authorId, "deprioritized");
      }
      await ephemeral(client, body, confirmation("snooze"));
    }, () => replyError(client, body));
  });

  app.action("mark_done", async ({ ack, body, client }) => {
    await ack();
    await safely("mark_done", async () => {
      const { permalink, userId, authorId } = actionTarget(body);
      if (permalink) {
        await getStore().snoozes.markDone(userId, permalink);
        await getStore().metrics.record(userId, { itemsRecovered: 1 });
        // Learn: handling this sender's item is positive engagement.
        if (authorId) await getStore().signals.record(userId, authorId, "engaged");
      }
      await ephemeral(client, body, confirmation("mark_done"));
    }, () => replyError(client, body));
  });

  app.action("nudge", async ({ ack, body, client }) => {
    await ack();
    await safely("nudge", async () => {
      const { permalink, userId } = actionTarget(body);
      const c = permalink ? await getStore().commitments.getByPermalink(userId, permalink) : undefined;
      if (!c) {
        await ephemeral(client, body, "I don't have that one cached anymore — run `/tempo commitments` again and try once more.");
        return;
      }
      await getStore().commitments.markNudged(userId, permalink);
      const draft = await draftNudge(c, container.llm(), await resolveDisplayName(client, userId));
      await postComposedDraft(client, body, draft);
    }, () => replyError(client, body));
  });

  app.action("renegotiate", async ({ ack, body, client }) => {
    await ack();
    await safely("renegotiate", async () => {
      const { permalink, userId } = actionTarget(body);
      const c = permalink ? await getStore().commitments.getByPermalink(userId, permalink) : undefined;
      if (!c) {
        await ephemeral(client, body, "I don't have that one cached anymore — run `/tempo commitments` again and try once more.");
        return;
      }
      await getStore().commitments.markRenegotiating(userId, permalink);
      const draft = await draftRenegotiation(c, container.llm(), await resolveDisplayName(client, userId));
      await postComposedDraft(client, body, draft);
    }, () => replyError(client, body));
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

  // ── v2.0 native surfaces ─────────────────────────────────────────────────
  app.action("refresh_canvas", async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any)?.user?.id ?? "U_SAM";
    await safely(
      "refresh_canvas",
      async () => {
        const res = await updateCanvas(await contextFor(client, userId));
        await ephemeral(
          client,
          body,
          res.ok
            ? `${res.created ? "Created" : "Refreshed"} your Tempo Canvas with today's plan. Nothing was sent — it's yours to open.`
            : "Couldn't reach the Canvas just now — *nothing was changed*. Try again in a moment.",
        );
      },
      () => replyError(client, body),
    );
  });

  app.action("sync_ledger_list", async ({ ack, body, client }) => {
    await ack();
    const userId = (body as any)?.user?.id ?? "U_SAM";
    await safely(
      "sync_ledger_list",
      async () => {
        const res = await syncCommitmentsToList(await contextFor(client, userId));
        await ephemeral(
          client,
          body,
          res.ok
            ? `Synced *${res.itemsWritten ?? res.count}* commitment${(res.itemsWritten ?? res.count) === 1 ? "" : "s"} to your Slack List. It mirrors your Ledger — only the facts, never the messages.`
            : "Couldn't sync the List just now — *nothing was changed*. Try again in a moment.",
        );
      },
      () => replyError(client, body),
    );
  });

  // Workflow Builder custom steps — Summarize what I missed / Draft a reply /
  // Block focus time / Add a commitment. Same receiver, same container.
  registerWorkflowSteps(app, {
    contextFor: (userId: string) => contextFor(app.client, userId),
    safely,
    snag: SNAG,
  });

  app.action("remind_commitment", async ({ ack, body, client }) => {
    await ack();
    await safely(
      "remind_commitment",
      async () => {
        const { permalink, userId } = actionTarget(body);
        const c = permalink ? await getStore().commitments.getByPermalink(userId, permalink) : undefined;
        if (!c) {
          await ephemeral(client, body, "I don't have that one cached anymore — run `/tempo commitments` again and try once more.");
          return;
        }
        // Remind an hour before the due date when we know it and it's still
        // ahead; otherwise a gentle default of 3 hours from now.
        const now = Math.floor(Date.now() / 1000);
        const time = c.dueTs && c.dueTs - 3600 > now ? c.dueTs - 3600 : now + 3 * 3600;
        const res = await remindAboutCommitment(await contextFor(client, userId), {
          what: c.what,
          counterparty: c.counterparty,
          direction: c.direction,
          time,
        });
        await ephemeral(
          client,
          body,
          res.ok ? "Set a Slack reminder so this doesn't slip. 👍" : "Couldn't set the reminder just now — try again in a moment.",
        );
      },
      () => replyError(client, body),
    );
  });

  return app;
}

export function createApp(): BoltApp {
  assertSlackRuntime();
  assertSecretsHardened();
  const app = new App({
    token: config.slack.botToken,
    signingSecret: config.slack.signingSecret,
    appToken: config.slack.appToken,
    socketMode: config.runtime.receiver === "socket",
    logLevel: LogLevel.INFO,
    clientOptions: webClientOptions,
  });
  return registerHandlers(app);
}

/**
 * HTTP receiver for a long-lived self-hosted server (non-Vercel prod). The
 * Vercel path is src/main/vercel.ts. Fails fast on a missing signing secret —
 * an ExpressReceiver verifying signatures against "" would accept forged
 * requests. Default (immediate) ack behavior: on a persistent server the
 * process outlives the response, so work continues after Slack is acked.
 */
export function createExpressApp() {
  if (!config.slack.signingSecret) {
    throw new Error("SLACK_SIGNING_SECRET is required for the HTTP receiver. See .env.example.");
  }
  if (!config.slack.botToken) {
    throw new Error("SLACK_BOT_TOKEN is required for the HTTP receiver. See .env.example.");
  }
  assertSecretsHardened();
  const receiver = new ExpressReceiver({ signingSecret: config.slack.signingSecret });
  const app = new App({ token: config.slack.botToken, receiver, clientOptions: webClientOptions });
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

/** The permalink + acting user (+ optional sender id) for a button click. Triage
 * buttons encode a `{"p":permalink,"s":authorId}` JSON value so we can attribute
 * the learning signal to a sender; ledger/other buttons pass a bare permalink,
 * which parses back to just `{permalink}` (authorId undefined). */
function actionTarget(body: any): { permalink: string; userId: string; authorId?: string } {
  const raw = body?.actions?.[0]?.value ?? "";
  const userId = body?.user?.id ?? "U_SAM";
  if (typeof raw === "string" && raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      return { permalink: String(parsed.p ?? ""), userId, authorId: parsed.s || undefined };
    } catch {
      /* fall through to bare-string handling */
    }
  }
  return { permalink: raw, userId };
}

async function postDraft(client: any, body: any) {
  const { permalink, userId, authorId } = actionTarget(body);
  const ctx = await contextFor(client, userId);
  const source = await sourceTextFor(ctx, permalink);
  const draft = await draftReply(source ?? "", ctx.llm, ctx.subjectName);
  // Learn: drafting a reply to this sender is positive engagement (triage
  // buttons carry the sender id; ledger "draft it now" buttons don't).
  if (authorId) await getStore().signals.record(userId, authorId, "engaged");
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
  const res = await ctx.rts.search({ query: CORPUS_QUERY, limit: 50 });
  return res.messages.find((m) => m.permalink === permalink)?.text;
}

/** Calm error reply for a failed action — ephemeral in-channel, DM from Home. */
async function replyError(client: any, body: any) {
  await ephemeral(client, body, SNAG);
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

/** When the user has the read-aloud a11y preference on, synthesizes the
 * response's speech script and DMs it as an audio file — always via DM
 * (never into a shared channel), matching Tempo's calm/private posture.
 * Best-effort: a synthesis/upload failure must never break message delivery. */
async function maybeSendReadAloud(client: any, userId: string, speech: string) {
  try {
    if (!resolveA11yPrefs(await getStore().prefs.get(userId)).readAloud) return;
    const tts = await getTtsClient().synthesize({ text: speech });
    if (!tts.ok || !tts.audioBase64) return;
    const im = await client.conversations.open({ users: userId });
    const channel = im?.channel?.id;
    if (!channel) return;
    await client.files.uploadV2({
      channel_id: channel,
      file: Buffer.from(tts.audioBase64, "base64"),
      filename: tts.filename ?? (tts.mimeType === "audio/wav" ? "tempo-read-aloud.wav" : "tempo-read-aloud.mp3"),
      title: "Tempo — read aloud",
      initial_comment: "🔊 Read-aloud version of my last reply.",
    });
  } catch (err) {
    console.error("read-aloud delivery failed", err);
  }
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
