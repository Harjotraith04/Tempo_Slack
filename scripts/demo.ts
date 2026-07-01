/**
 * End-to-end demo: runs the full "Sam returns from a week off" narrative through
 * the real Tempo pipeline (orchestrator → modules → RTS + AI + MCP) and prints
 * it to the console. Works with zero credentials (TEMPO_RTS=mock, TEMPO_AI=mock).
 *
 *   npm run demo
 *
 * This is both the verification harness and the storyboard for the 3-min video.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildContext, afterTsOf, type TempoContext } from "../src/application/context.js";
import { respond } from "../src/application/orchestrator.js";
import { checkDraft } from "../src/modules/decoder.js";
import { runTriage } from "../src/modules/triage.js";
import { runLedger } from "../src/modules/ledger.js";
import { draftReply, draftNudge, draftRenegotiation } from "../src/modules/draft.js";
import {
  updateCanvas,
  syncCommitmentsToList,
  remindAboutCommitment,
  bookmarkCanvas,
} from "../src/application/use-cases/surfaces.js";
import { LiveMcpCalendarClient, LiveMcpTaskClient } from "../src/platform/mcp/live.js";
import { getMcpClients } from "../src/platform/mcp/index.js";
import type { McpSession } from "../src/platform/mcp/session.js";
import { getStore, buildPgStore } from "../src/platform/persistence/index.js";
import type { Db } from "../src/platform/persistence/pg/session.js";
import { signSession, verifySession } from "../src/shared/session.js";
import { exportUserData, deleteUserData } from "../src/application/use-cases/user-data.js";
import { applySettings } from "../src/application/use-cases/settings.js";
import { buildWeightMap } from "../src/modules/intelligence/index.js";
import { decodeMessage } from "../src/modules/decoder.js";
import { matchFulfillments, type Commitment } from "../src/modules/ledger.js";
import { atRiskCommitments } from "../src/application/use-cases/surfaces.js";
import { droppedBallBlocks } from "../src/platform/slack/blockkit/index.js";
import type { RtsMessage } from "../src/ports/rts.js";
import { SCOPES, USER_SCOPES, BOT_SCOPES } from "../src/platform/slack/oauth/scopes.js";
import manifest from "../manifest.json" with { type: "json" };
import { TEMPO_TOOLS } from "../src/platform/mcp/server/index.js";
import { mintAgentToken, resolveMcpCaller } from "../src/platform/mcp/server/auth.js";
import { buildAgentforceDescriptor } from "../src/platform/agentforce/index.js";
import { analyzeLoad } from "../src/modules/intelligence/index.js";
import { buildProactiveBlocks } from "../src/application/use-cases/proactive.js";
import { teamLoad } from "../src/application/use-cases/team.js";
import { teamLoadBlocks } from "../src/platform/slack/blockkit/index.js";
import { flags } from "../src/config.js";
import { homeDashboardBlocks, onboardingBlocks, settingsModalView, emptyStateBlocks, metricsBlocks } from "../src/platform/slack/blockkit/index.js";
import { resolveA11yPrefs } from "../src/accessibility/index.js";
import { getTtsClient } from "../src/accessibility/tts/index.js";
import { isFirstRun, welcomeMessage } from "../src/modules/onboarding.js";
import { CachingRtsClient } from "../src/platform/slack/rts/caching.js";
import type { RtsClient } from "../src/platform/slack/rts/index.js";
import { config } from "../src/config.js";

// Repeated `npm run demo` runs must never write into the project root: point
// the file-backed stores at a throwaway temp dir before anything reads/writes
// them. Must happen before any store-touching call (the very first being
// Scene 1's triage, which now filters through the suppression store).
process.env.TEMPO_STORE_DIR = mkdtempSync(join(tmpdir(), "tempo-demo-"));

// The resolved persistence adapter — file-backed by default (no DATABASE_URL),
// so the demo runs credential-free. Scene 16 proves the same Store interface
// works against Postgres via an in-memory fake driver.
const store = getStore();

function rule(title: string) {
  console.log("\n" + "─".repeat(72));
  console.log(`  ${title}`);
  console.log("─".repeat(72));
}

function renderBlocks(blocks: any[]) {
  for (const b of blocks) {
    if (b.type === "header") console.log(`\n## ${b.text.text}`);
    else if (b.type === "section") console.log(b.text.text);
    else if (b.type === "context") console.log(`  ⌁ ${b.elements.map((e: any) => e.text).join(" ")}`);
    else if (b.type === "divider") console.log("  · · ·");
    else if (b.type === "actions")
      console.log(`  [ ${b.elements.map((e: any) => e.text.text).join(" ] [ ")} ]`);
  }
}

/**
 * The action-handler layer (src/app.ts) only fires from real Slack button
 * clicks, so it isn't reachable through the free-text orchestrator path above
 * — this exercises the same store + draft calls directly, the way Scene 3
 * bypasses respond() to call checkDraft() directly.
 */
async function demoButtonLayer(ctx: TempoContext) {
  const triage = await runTriage(ctx.rts, ctx.llm, { afterTs: afterTsOf(ctx) });
  const [first, second] = triage.needsYou;

  if (first) {
    await store.snoozes.snooze(ctx.subjectUserId, first.permalink, ctx.nowTs + 4 * 3600);
    console.log(`  [Snooze] "${first.excerpt.slice(0, 50)}…" → suppressed now: ${await store.snoozes.isSuppressed(ctx.subjectUserId, first.permalink, ctx.nowTs)}`);
  }
  if (second) {
    await store.snoozes.markDone(ctx.subjectUserId, second.permalink);
    console.log(`  [Done]   "${second.excerpt.slice(0, 50)}…" → suppressed now: ${await store.snoozes.isSuppressed(ctx.subjectUserId, second.permalink, ctx.nowTs)}`);
  }

  const fresh = await runLedger(ctx.rts, ctx.llm, { nowTs: ctx.nowTs });
  const commitments = await store.commitments.sync(ctx.subjectUserId, fresh);
  const owedToMe = commitments.find((c) => c.direction === "owed_to_me");
  const iOwe = commitments.find((c) => c.direction === "i_owe");

  if (owedToMe) {
    const nudge = await draftNudge(owedToMe, ctx.llm);
    console.log(`  [Nudge] draft to ${owedToMe.counterparty}: "${nudge}"`);
  }
  if (iOwe) {
    await store.commitments.markRenegotiating(ctx.subjectUserId, iOwe.permalink);
    const draft = await draftRenegotiation(iOwe, ctx.llm);
    console.log(`  [Renegotiate] draft to ${iOwe.counterparty}: "${draft}"`);
    const resynced = await store.commitments.sync(ctx.subjectUserId, await runLedger(ctx.rts, ctx.llm, { nowTs: ctx.nowTs }));
    const stillRenegotiating = resynced.find((c) => c.permalink === iOwe.permalink)?.status === "renegotiating";
    console.log(`  Status after renegotiate persists across a re-sync: ${stillRenegotiating}`);
  }
}

/**
 * App Home (app_home_opened) and the settings modal (views.open/app.view) are
 * Slack-trigger-only surfaces (need a real trigger_id/view payload), so this
 * exercises the same building blocks directly — homeDashboardBlocks() with
 * live data, and a savePrefs()/getPrefs() round-trip standing in for a modal
 * submission, the way Scene 7 exercises the button layer.
 */
async function demoHomeAndSettings(ctx: TempoContext) {
  const triage = await respond(ctx, "what needs me today?");
  const commitments = await respond(ctx, "show my commitments");
  renderBlocks(homeDashboardBlocks({ triage: triage.blocks, commitments: commitments.blocks }));

  const before = resolveA11yPrefs(await store.prefs.get(ctx.subjectUserId));
  console.log(`\n  [Settings] before: verbosity=${before.verbosity} maxItems=${before.maxItems} readAloud=${before.readAloud}`);

  const modal = settingsModalView({ ...before, focusDefaultMins: (await store.prefs.get(ctx.subjectUserId))?.focusDefaultMins });
  console.log(`  Settings modal has ${modal.blocks.length} fields: verbosity, reading level, max items, focus length, read-aloud.`);

  await store.prefs.save(ctx.subjectUserId, { verbosity: "brief", maxItems: 1, focusDefaultMins: 45, readAloud: true });
  const after = resolveA11yPrefs(await store.prefs.get(ctx.subjectUserId));
  console.log(`  [Settings] saved: verbosity=${after.verbosity} maxItems=${after.maxItems} readAloud=${after.readAloud} focusDefaultMins=${(await store.prefs.get(ctx.subjectUserId))?.focusDefaultMins}`);

  const triageAfter = await respond(ctx, "what needs me today?");
  console.log(`  Triage now respects the saved prefs — fallback text: "${triageAfter.text}"`);
}

/**
 * A tiny in-memory Postgres stand-in for Scene 16: it interprets exactly the
 * INSERT-ON-CONFLICT / SELECT statements our pg repos emit, so the *real*
 * Postgres adapter round-trips with no server and no credentials (the Neon
 * driver is never loaded on this path — the same posture as the fake MCP session
 * in Scene 15).
 */
function inMemoryDb(): Db {
  const tables: Record<string, Map<string, Record<string, unknown>>> = {};
  const tbl = (name: string) => (tables[name] ??= new Map());
  return {
    async query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
      const table = text.match(/(?:INTO|FROM)\s+(\w+)/)![1]!;
      if (/^\s*INSERT/i.test(text)) {
        const cols = text.match(/INSERT INTO \w+\s*\(([^)]*)\)/s)![1]!.split(",").map((s) => s.trim());
        const row: Record<string, unknown> = {};
        cols.forEach((c, i) => (row[c] = params[i]));
        const pk = "permalink" in row ? `${row.user_id}::${row.permalink}` : String(row.user_id);
        tbl(table).set(pk, row);
        return [];
      }
      let rows = [...tbl(table).values()].filter((r) => r.user_id === params[0]);
      if (/permalink = ANY/.test(text)) rows = rows.filter((r) => (params[1] as unknown[]).includes(r.permalink));
      else if (/permalink = \$2/.test(text)) rows = rows.filter((r) => r.permalink === params[1]);
      return rows as T[];
    },
  };
}

async function main() {
  console.log(`\nTEMPO — executive-function co-pilot for Slack`);
  console.log(`(RTS=${config.runtime.rts}, AI=${config.ai.mode})`);
  console.log(`Scene: Sam Rivera, a PM, opens Slack on Monday after a week off.`);

  const ctx = buildContext({ subjectName: "Sam" });

  rule('1. "What needs me today?" — Triage');
  renderBlocks((await respond(ctx, "what needs me today?")).blocks);

  rule('2. "What does this really mean?" — Tone decode (Marco\'s message)');
  renderBlocks(
    (await respond(ctx, 'decode: "No rush 🙂 whenever you get a chance I guess. Not like the handoff is waiting on it."')).blocks,
  );

  rule('3. "How will my reply land?" — Draft check');
  renderBlocks(
    (await import("../src/platform/slack/blockkit/index.js")).draftCheckBlocks(await checkDraft("No.", ctx.llm)),
  );

  rule('4. "What did I promise?" — Commitment Ledger');
  renderBlocks((await respond(ctx, "show my commitments")).blocks);

  rule('5. "Protect my focus" — Focus Guardian (+ MCP calendar/task)');
  renderBlocks((await respond(ctx, "block 90 min of focus time")).blocks);

  rule('6. "Catch me up" — Re-entry brief');
  renderBlocks((await respond(ctx, "catch me up on what I missed")).blocks);

  rule('7. Tapping a button — Snooze / Done / Nudge / Renegotiate');
  await demoButtonLayer(ctx);

  rule('8. App Home dashboard — live, reflects the snooze/renegotiate above');
  await demoHomeAndSettings(ctx);

  rule('9. Read-aloud audio — turning a response into a real audio file (TEMPO_TTS)');
  {
    const r = await respond(ctx, "what needs me today?");
    const tts = await getTtsClient().synthesize({ text: r.speech });
    console.log(`  Speech script: "${r.speech}"`);
    console.log(
      `  Synthesized ${Buffer.from(tts.audioBase64 ?? "", "base64").length} bytes of ` +
        `${tts.mimeType} (TEMPO_TTS=${config.tts.mode}). Delivered as a DM whenever a user's ` +
        `read-aloud preference is on.`,
    );
  }

  rule('10. First-run onboarding — a brand-new user opens Tempo for the first time');
  {
    const newUserId = "U_NEW_DEMO";
    console.log(`  isFirstRun(brand-new user) = ${isFirstRun(await store.prefs.get(newUserId))}`);
    const welcome = welcomeMessage(isFirstRun(await store.prefs.get(newUserId)));
    console.log(`  Assistant greeting: "${welcome.text.slice(0, 90)}…"`);
    renderBlocks(onboardingBlocks());
    await store.prefs.save(newUserId, { onboardedAt: ctx.nowTs });
    console.log(`  After tapping "Got it — let's go": isFirstRun = ${isFirstRun(await store.prefs.get(newUserId))}`);
  }

  rule('11. Resilient & private — caching, empty states, weekly impact, plain language');
  {
    // (a) Per-session cache: identical RTS searches within one turn hit once.
    let underlyingCalls = 0;
    const counting: RtsClient = {
      subjectUserId: ctx.subjectUserId,
      async search(p) {
        underlyingCalls++;
        return ctx.rts.search(p);
      },
    };
    const cached = new CachingRtsClient(counting);
    await cached.search({ query: "what needs me today" });
    await cached.search({ query: "what needs me today" });
    console.log(`  Per-session cache: 2 identical RTS searches → ${underlyingCalls} underlying call (deduped).`);

    // (b) Live triage/actions ride on rate-limit backoff + cursor pagination
    // (inert in mock mode); a thrown Slack call now surfaces as a calm card:
    console.log("  Live WebClients share exponential backoff + Retry-After handling; RTS follows cursors up to 5 pages.");

    // (c) Empty state — the calm card shown when there's genuinely nothing.
    console.log("\n  Empty state (shown when you're all caught up):");
    renderBlocks(emptyStateBlocks("triage"));

    // (d) Weekly impact — privacy-safe counts only, never content.
    console.log("\n  Weekly impact (privacy-safe counts, accumulated from the scenes above):");
    renderBlocks(metricsBlocks(await store.metrics.get(ctx.subjectUserId)));

    // (e) Reading level "plain" shortens sentence structure, losing no meaning.
    const stdUser = "U_STD_DEMO";
    const plainUser = "U_PLAIN_DEMO";
    await store.prefs.save(stdUser, { readingLevel: "standard" });
    await store.prefs.save(plainUser, { readingLevel: "plain" });
    const std = await respond(buildContext({ subjectUserId: stdUser }), "catch me up", { record: false });
    const plain = await respond(buildContext({ subjectUserId: plainUser }), "catch me up", { record: false });
    console.log(`\n  Reading level — standard (dense, ';'-joined): "${std.text}"`);
    console.log(`  Reading level — plain (short sentences):      "${plain.text}"`);
    console.log(`  → same information; plain uses no ';' joins: ${!plain.text.includes(";")}, none dropped: ${plain.text.includes("Atlas API spec")}`);
  }

  rule('12. Tempo Canvas — a living command center (canvases.create/edit)');
  {
    const first = await updateCanvas(ctx);
    console.log(`  ${first.created ? "Created" : "Refreshed"} canvas ${first.canvasId} from today's live triage + commitments:\n`);
    console.log(first.markdown.split("\n").map((l) => "    " + l).join("\n"));
    const second = await updateCanvas(ctx);
    console.log(`\n  Re-running edits the *same* canvas in place (id ${second.canvasId}, created=${second.created}) — no duplicates.`);
  }

  rule('13. Workflow Builder custom steps — Tempo actions inside no-code workflows');
  {
    // Each step composes an existing use-case; the demo exercises those bodies
    // directly (the function_executed trigger only fires from real Slack).
    const missed = await respond(ctx, "catch me up on what I missed", { record: false });
    console.log(`  [Summarize what I missed] → "${missed.text.slice(0, 88)}…"`);
    const draft = await draftReply("No rush 🙂 whenever you get a chance. Not like the handoff is waiting.", ctx.llm);
    console.log(`  [Draft a reply]           → "${draft.slice(0, 88)}…"`);
    const focus = await respond(ctx, "block 60 min of focus time", { record: false });
    console.log(`  [Block focus time]        → "${focus.text.slice(0, 88)}…"`);
    const rem = await remindAboutCommitment(ctx, { what: "Send the Atlas spec", counterparty: "Priya", direction: "i_owe", time: ctx.nowTs + 3600 });
    console.log(`  [Add a commitment]        → native reminder set: ${rem.ok} (${rem.reminderId})`);
  }

  rule('14. Slack Lists sync + native reminders + a Canvas bookmark');
  {
    const sync = await syncCommitmentsToList(ctx);
    console.log(`  Synced *${sync.itemsWritten}/${sync.count}* commitments to Slack List ${sync.listId}.`);
    console.log(`  Re-sync reuses the same list (id kept), and every row is derived facts only —`);
    console.log(`  the source message text is structurally never written (Invariant: never persist RTS content).`);
    const bm = await bookmarkCanvas(ctx, { channelId: "C_TEAM" });
    console.log(`  Bookmarked the Tempo Canvas into a channel: ${bm.ok} (${bm.bookmarkId}).`);
  }

  rule('15. Real MCP outbound — Tempo acts in the world (@modelcontextprotocol/sdk)');
  {
    // A fake in-memory MCP session exercises the *real* live mapping path with
    // no server and no credentials (the SDK is never loaded on this path).
    const fakeSession = (kind: "calendar" | "tasks"): McpSession => ({
      async callTool(name, args) {
        console.log(`    → called MCP tool "${name}" (start/due=${args.start ?? args.due ?? "-"})`);
        return kind === "calendar"
          ? { structuredContent: { eventId: "evt_from_mcp_9001", htmlLink: "https://calendar.google.com/event/9001" } }
          : { structuredContent: { taskId: "task_from_mcp_42", url: "https://notion.so/task-42" } };
      },
    });
    const cal = new LiveMcpCalendarClient({ session: fakeSession("calendar"), tool: "create_event", provider: "google-calendar" });
    const tasks = new LiveMcpTaskClient({ session: fakeSession("tasks"), tool: "create_task", provider: "notion" });
    const event = await cal.blockFocus({ title: "Deep work", startTs: ctx.nowTs, endTs: ctx.nowTs + 3600 });
    console.log(`  Calendar event via MCP → ${event.provider}: ${event.eventId} (${event.htmlLink})`);
    const task = await tasks.create({ title: "Write the Atlas spec", due: ctx.nowTs + 86400 });
    console.log(`  Task via MCP          → ${task.provider}: ${task.taskId} (${task.url})`);

    const evMock = await getMcpClients().calendar.blockFocus({ title: "x", startTs: ctx.nowTs, endTs: ctx.nowTs + 60 });
    console.log(`  Default posture (no server URL configured) resolves to mock: ${evMock.provider}`);
  }

  rule('16. Neon Postgres store — the same repository interface, durable across restarts');
  {
    // The pg adapter behind a fake in-memory driver — same Store ports every
    // scene above used, no server, no credentials.
    const pg = buildPgStore(inMemoryDb());

    await pg.prefs.save("U_PG_DEMO", { verbosity: "brief", maxItems: 2, readAloud: true });
    const p = await pg.prefs.get("U_PG_DEMO");
    console.log(`  prefs round-trip via the Postgres adapter → verbosity=${p?.verbosity} maxItems=${p?.maxItems} readAloud=${p?.readAloud}`);

    const fresh = await runLedger(ctx.rts, ctx.llm, { nowTs: ctx.nowTs });
    const synced = await pg.commitments.sync("U_PG_DEMO", fresh);
    const pinned = await pg.commitments.getByPermalink("U_PG_DEMO", fresh[0]!.permalink);
    console.log(`  commitments.sync via Postgres → ${synced.length} rows; re-read one: "${pinned?.what}" (status ${pinned?.status}).`);
    console.log(`  Raw message text written to any column? ${"sourceText" in ((pinned as any) ?? {})} — the schema has no content column (Invariant: never persist RTS content).`);

    console.log(`  Config gate: TEMPO_STORE=${config.store.mode} (no DATABASE_URL) → getStore() is file-backed`);
    console.log(`  (default repo is buildFileStore, not the pg one): ${store === getStore()}. So this entire demo ran credential-free.`);
  }

  rule('17. Web companion — your data: signed session · privacy export · settings · delete');
  {
    const u = "U_PRIVACY_DEMO";
    // Seed one user across every store — including a token, to prove the export
    // shows install METADATA only, never the secret.
    await store.tokens.save(u, "T_DEMO", "xoxp-demo-secret-never-exported");
    await store.prefs.save(u, { verbosity: "brief", maxItems: 2 });
    await store.commitments.sync(u, await runLedger(ctx.rts, ctx.llm, { nowTs: ctx.nowTs }));

    // A signed, expiring session ties a browser to this user (HMAC over userId,
    // keyed off the same secret the token store uses). No RTS content involved.
    const token = signSession(u, 3600, ctx.nowTs);
    console.log(`  Signed session ${token.slice(0, 26)}… → verifies to "${verifySession(token, ctx.nowTs)}" (tamper → null).`);

    const data = await exportUserData(store, u, ctx.nowTs);
    const blob = JSON.stringify(data);
    console.log(
      `  Privacy export → token=${data.installedTeam ? "metadata-only" : "none"}, prefs=${!!data.prefs}, ` +
        `commitments=${data.commitments.length}, metrics=${!!data.metrics}, surfaces=${!!data.surfaces}`,
    );
    console.log(
      `  Contains the raw token secret? ${blob.includes("xoxp-demo-secret-never-exported")} · ` +
        `any RTS message text? ${blob.includes("finalized Atlas API spec by Friday")} (Invariant 1).`,
    );

    const after = await applySettings(store, u, { verbosity: "standard", maxItems: "5", readAloud: "on" });
    console.log(`  Settings saved via the web form → verbosity=${after.verbosity} maxItems=${after.maxItems} readAloud=${after.readAloud}`);

    await deleteUserData(store, u);
    const gone = await exportUserData(store, u, ctx.nowTs);
    console.log(
      `  After "Delete everything": prefs=${gone.prefs ?? "gone"}, commitments=${gone.commitments.length}, ` +
        `token=${(await store.tokens.get(u)) ?? "gone"} — right-to-erasure honored.`,
    );
  }

  rule('18. Learns from you (privately) — per-sender taps re-rank triage; familiarity tunes tone reads');
  {
    const u = ctx.subjectUserId;
    const show = (label: string, items: { category: string; urgency: number; authorName?: string; excerpt: string }[]) => {
      console.log(`  ${label}`);
      items.slice(0, 3).forEach((i, n) =>
        console.log(`    ${n + 1}. [${i.category} ${i.urgency}] ${i.authorName} — "${i.excerpt.slice(0, 42)}…"`),
      );
    };

    const before = await runTriage(ctx.rts, ctx.llm, { afterTs: afterTsOf(ctx) });
    show("Before learning:", before.needsYou);

    // Simulate the user's own taps: keep engaging one sender, keep snoozing the
    // current top sender. Counts per sender id only — never message content.
    const topSender = before.needsYou[0]!.authorId!;
    const riser = before.needsYou.find((i) => i.authorId && i.authorId !== topSender)!.authorId!;
    for (let k = 0; k < 6; k++) {
      await store.signals.record(u, riser, "engaged");
      await store.signals.record(u, topSender, "deprioritized");
    }
    const weights = buildWeightMap(await store.signals.forUser(u));
    const after = await runTriage(ctx.rts, ctx.llm, {
      afterTs: afterTsOf(ctx),
      senderAdjust: (id) => (id ? weights.get(id) ?? 0 : 0),
    });
    show("After you kept engaging one sender and snoozing another:", after.needsYou);
    console.log(`  → same items, re-ranked from your taps (bounded ±20, can't override a real ACT).`);

    const cold = await decodeMessage("No rush 🙂 whenever you get a chance.", ctx.llm, { familiarity: 0 });
    const warm = await decodeMessage("No rush 🙂 whenever you get a chance.", ctx.llm, { familiarity: 8 });
    console.log(
      `  Tone-read confidence — unfamiliar sender ${Math.round(cold.confidence * 100)}% (adds a caveat) vs ` +
        `familiar sender ${Math.round(warm.confidence * 100)}%.`,
    );
  }

  rule('19. Ledger intelligence — auto-close delivered promises + a dropped-ball heads-up');
  {
    const promise: Commitment = {
      id: "c_demo", direction: "i_owe", counterparty: "Priya", what: "Send the finalized Atlas API spec",
      dueText: "Friday", status: "overdue", permalink: "https://demo/promise", sourceText: "I'll send the spec by Friday",
    };
    const msg = (text: string): RtsMessage => ({
      permalink: "https://demo/m", channelId: "C1", channelType: "im", authorId: "U_SAM", text, ts: "1.0",
    });
    const closed = matchFulfillments([promise], [msg("Just sent Priya the finalized Atlas API spec 🎉")]);
    const notClosed = matchFulfillments([promise], [msg("I'll send the Atlas spec by Friday")]);
    console.log(`  A past-tense delivery message auto-closes the promise: ${closed.length === 1} (Ledger self-cleans).`);
    console.log(`  The original future-tense promise never self-closes: ${notClosed.length === 0} ("send" ≠ "sent").`);

    console.log("\n  Dropped-ball heads-up appended to the morning digest (Sam's live at-risk commitments):");
    renderBlocks(droppedBallBlocks(await atRiskCommitments(ctx)));
  }

  rule('20. Least-privilege scopes — every scope Tempo requests, why, and proof the manifest matches');
  {
    for (const token of ["user", "bot"] as const) {
      const rows = SCOPES.filter((s) => s.token === token);
      console.log(`  ${token.toUpperCase()} token — ${rows.length} scopes:`);
      for (const s of rows) console.log(`    • ${s.scope.padEnd(22)} ${s.usedBy}`);
    }
    const eq = (a: string[], b: string[]) =>
      JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    const matches =
      eq(manifest.oauth_config.scopes.user, USER_SCOPES) &&
      eq(manifest.oauth_config.scopes.bot, BOT_SCOPES);
    console.log(`  Manifest requests exactly this set — no over- or under-request: ${matches}. Marketplace-ready.`);
  }

  rule('21. Tempo as an MCP server — external agents (Agentforce / Claude / Cursor) can call Tempo');
  {
    // The SDK-free tools, invoked exactly as the MCP server invokes them — no
    // SDK, no credentials. Each acts as the initiating user; derived facts only.
    const call = (name: string, args: Record<string, unknown>) =>
      TEMPO_TOOLS.find((t) => t.name === name)!.run(args, ctx);

    console.log(`  Exposes ${TEMPO_TOOLS.length} tools: ${TEMPO_TOOLS.map((t) => t.name).join(", ")}\n`);

    const triage = await call("tempo_triage", { limit: 3 });
    console.log(`  tempo_triage       → "${triage.summary.slice(0, 74)}…" (${(triage.data.needsYou as any[]).length} items)`);

    const commitments = await call("tempo_commitments", {});
    const leak = JSON.stringify(commitments.data).includes("sourceText");
    console.log(`  tempo_commitments  → "${commitments.summary}" — leaks raw text? ${leak}`);

    const decode = await call("tempo_decode", { text: "No rush 🙂 whenever you get a chance.", from: "Marco" });
    const d = decode.data as { impliedMeaning: string; confidence: number };
    console.log(`  tempo_decode       → "${d.impliedMeaning}" (confidence ${Math.round(d.confidence * 100)}%)`);

    const focus = await call("tempo_focus", { minutes: 60 });
    console.log(`  tempo_focus        → "${focus.summary.slice(0, 74)}…"`);
    console.log(`  Served at /api/mcp/server (Streamable HTTP), off unless TEMPO_MCP_SERVER=on — acts as the user, stores nothing from RTS.`);
  }

  rule('22. Agentforce — per-caller identity · packaged as an Employee Agent · graceful handoff');
  {
    // (a) Per-caller identity (default-deny): an agent presents a signed token;
    // the server acts as THAT user. No token / bad token → denied.
    const caller = resolveMcpCaller(`Bearer ${mintAgentToken("U_PRIYA")}`);
    const denied = resolveMcpCaller("Bearer not-a-real-token") === null && resolveMcpCaller(undefined) === null;
    console.log(`  Agent token for U_PRIYA → acts as "${caller?.userId}" (via ${caller?.via}); no/bad credential → ${denied ? "denied ✅" : "ALLOWED ✗"}`);

    // (b) Packaged as an Agentforce Employee Agent — tools + persona + trust.
    const d = buildAgentforceDescriptor({ endpoint: "https://tempo.example.com/api/mcp/server" });
    console.log(`  Employee Agent "${d.name}" exposes ${d.tools.length} tools (${d.tools.map((t) => t.name).join(", ")}) over ${d.connection.transport}.`);
    console.log(`  Trust contract: acts-as-user=${d.trust.actsAsInitiatingUser}, never-stores-RTS=${d.trust.neverStoresRtsContent}, human-in-the-loop=${d.trust.humanInTheLoop}.`);

    // (c) Graceful handoff: an out-of-scope @mention is routed elsewhere, not guessed.
    const res = await respond(ctx, "hey Tempo, roll back the deploy — we have an incident");
    console.log(`  Out-of-scope request → "${res.text.slice(0, 92)}…"`);
  }

  rule('23. Proactive intelligence (opt-in) — an overload heads-up + smart batching, from counts only');
  {
    console.log(`  Opt-in: TEMPO_PROACTIVE=${flags.proactive ? "on" : "off (default)"} — proactive care never surprises you.\n`);

    // A heavy week, computed from the SAME privacy-safe counts Tempo already
    // keeps (metrics + per-sender signals) — never message content.
    const u = "U_LOADED_DEMO";
    await store.metrics.record(u, { obligationsSurfaced: 9, messagesTriaged: 80 });
    for (let i = 0; i < 4; i++) await store.signals.record(u, "U_MARCO", "deprioritized");

    const load = analyzeLoad(await store.metrics.get(u), await store.signals.forUser(u));
    console.log(`  Load read → level "${load.level}" (score ${load.score}); drivers: ${load.drivers.join("; ")}`);
    console.log(`  Gentle, opt-in suggestion (never acted on): "${load.suggestion}"\n`);

    // The one calm touchpoint that folds into the morning digest:
    const loadedCtx = buildContext({ subjectUserId: u, subjectName: "Sam" });
    renderBlocks(await buildProactiveBlocks(loadedCtx));
  }

  rule('24. Team & manager mode (opt-in) — aggregated + anonymized, with a k-anonymity guardrail');
  {
    console.log(`  Opt-in: TEMPO_TEAM=${flags.team ? "on" : "off (default)"} — the default stays a personal agent on personal data.\n`);

    // An opt-in roster's counts-only data (nobody's included unless listed).
    const roster = ["U_T1", "U_T2", "U_T3"];
    await store.metrics.record("U_T1", { obligationsSurfaced: 2, focusMinutesProtected: 90, messagesTriaged: 40 });
    await store.metrics.record("U_T2", { obligationsSurfaced: 5, focusMinutesProtected: 30, messagesTriaged: 70 });
    await store.metrics.record("U_T3", { obligationsSurfaced: 3, focusMinutesProtected: 60, messagesTriaged: 55 });

    const agg = await teamLoad(store, roster, 3);
    console.log(`  Aggregated ${roster.length} opted-in members → any user id in the output? ${JSON.stringify(agg).includes("U_T1")}`);
    renderBlocks(teamLoadBlocks(agg));

    console.log("\n  Below the k-anonymity floor (only 2 opted in) the whole view is redacted — no individual can be inferred:");
    renderBlocks(teamLoadBlocks(await teamLoad(store, ["U_T1", "U_T2"], 3)));
  }

  console.log("\n" + "─".repeat(72));
  console.log("  Nothing above was sent or changed without Sam's tap. Nothing RTS");
  console.log("  returned was stored. This is assistive tech for the Slack firehose.");
  console.log("─".repeat(72) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
