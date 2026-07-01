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
import { draftNudge, draftRenegotiation } from "../src/modules/draft.js";
import { snoozeItem, markItemDone, isSuppressed } from "../src/platform/persistence/snoozes.js";
import { syncCommitments, markRenegotiating } from "../src/platform/persistence/commitments.js";
import { homeDashboardBlocks, onboardingBlocks, settingsModalView, emptyStateBlocks, metricsBlocks } from "../src/platform/slack/blockkit/index.js";
import { getPrefs, savePrefs } from "../src/platform/persistence/prefs.js";
import { getMetrics } from "../src/platform/persistence/metrics.js";
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
  const triage = await runTriage(ctx.rts, { afterTs: afterTsOf(ctx) });
  const [first, second] = triage.needsYou;

  if (first) {
    snoozeItem(ctx.subjectUserId, first.permalink, ctx.nowTs + 4 * 3600);
    console.log(`  [Snooze] "${first.excerpt.slice(0, 50)}…" → suppressed now: ${isSuppressed(ctx.subjectUserId, first.permalink, ctx.nowTs)}`);
  }
  if (second) {
    markItemDone(ctx.subjectUserId, second.permalink);
    console.log(`  [Done]   "${second.excerpt.slice(0, 50)}…" → suppressed now: ${isSuppressed(ctx.subjectUserId, second.permalink, ctx.nowTs)}`);
  }

  const fresh = await runLedger(ctx.rts, { nowTs: ctx.nowTs });
  const commitments = syncCommitments(ctx.subjectUserId, fresh);
  const owedToMe = commitments.find((c) => c.direction === "owed_to_me");
  const iOwe = commitments.find((c) => c.direction === "i_owe");

  if (owedToMe) {
    const nudge = await draftNudge(owedToMe);
    console.log(`  [Nudge] draft to ${owedToMe.counterparty}: "${nudge}"`);
  }
  if (iOwe) {
    markRenegotiating(ctx.subjectUserId, iOwe.permalink);
    const draft = await draftRenegotiation(iOwe);
    console.log(`  [Renegotiate] draft to ${iOwe.counterparty}: "${draft}"`);
    const resynced = syncCommitments(ctx.subjectUserId, await runLedger(ctx.rts, { nowTs: ctx.nowTs }));
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

  const before = resolveA11yPrefs(getPrefs(ctx.subjectUserId));
  console.log(`\n  [Settings] before: verbosity=${before.verbosity} maxItems=${before.maxItems} readAloud=${before.readAloud}`);

  const modal = settingsModalView({ ...before, focusDefaultMins: getPrefs(ctx.subjectUserId)?.focusDefaultMins });
  console.log(`  Settings modal has ${modal.blocks.length} fields: verbosity, reading level, max items, focus length, read-aloud.`);

  savePrefs(ctx.subjectUserId, { verbosity: "brief", maxItems: 1, focusDefaultMins: 45, readAloud: true });
  const after = resolveA11yPrefs(getPrefs(ctx.subjectUserId));
  console.log(`  [Settings] saved: verbosity=${after.verbosity} maxItems=${after.maxItems} readAloud=${after.readAloud} focusDefaultMins=${getPrefs(ctx.subjectUserId)?.focusDefaultMins}`);

  const triageAfter = await respond(ctx, "what needs me today?");
  console.log(`  Triage now respects the saved prefs — fallback text: "${triageAfter.text}"`);
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
    (await import("../src/platform/slack/blockkit/index.js")).draftCheckBlocks(await checkDraft("No.")),
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
    console.log(`  isFirstRun(brand-new user) = ${isFirstRun(getPrefs(newUserId))}`);
    const welcome = welcomeMessage(isFirstRun(getPrefs(newUserId)));
    console.log(`  Assistant greeting: "${welcome.text.slice(0, 90)}…"`);
    renderBlocks(onboardingBlocks());
    savePrefs(newUserId, { onboardedAt: ctx.nowTs });
    console.log(`  After tapping "Got it — let's go": isFirstRun = ${isFirstRun(getPrefs(newUserId))}`);
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
    renderBlocks(metricsBlocks(getMetrics(ctx.subjectUserId)));

    // (e) Reading level "plain" shortens sentence structure, losing no meaning.
    const stdUser = "U_STD_DEMO";
    const plainUser = "U_PLAIN_DEMO";
    savePrefs(stdUser, { readingLevel: "standard" });
    savePrefs(plainUser, { readingLevel: "plain" });
    const std = await respond(buildContext({ subjectUserId: stdUser }), "catch me up", { record: false });
    const plain = await respond(buildContext({ subjectUserId: plainUser }), "catch me up", { record: false });
    console.log(`\n  Reading level — standard (dense, ';'-joined): "${std.text}"`);
    console.log(`  Reading level — plain (short sentences):      "${plain.text}"`);
    console.log(`  → same information; plain uses no ';' joins: ${!plain.text.includes(";")}, none dropped: ${plain.text.includes("Atlas API spec")}`);
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
