/**
 * Shared read models — the canonical "what does the user's Slack look like right
 * now" queries, composed once and reused by every surface (the orchestrator, the
 * native-surface use-cases, and the inbound MCP server). Keeping them here means
 * triage's suppression + learned-weight blend and the ledger's fulfillment
 * auto-close behave identically no matter who asks.
 */

import { afterTsOf, type TempoContext } from "./context.js";
import { runTriage, type TriageResult } from "../modules/triage.js";
import { runLedger, detectFulfilledCommitments, type Commitment } from "../modules/ledger.js";
import { buildWeightMap } from "../modules/intelligence/index.js";

/** Suppression-aware, learning-weighted live triage (excludes snoozed/done). */
export async function liveTriage(ctx: TempoContext): Promise<TriageResult> {
  const [sigs, active] = await Promise.all([
    ctx.store.signals.forUser(ctx.subjectUserId),
    ctx.store.snoozes.active(ctx.subjectUserId, ctx.nowTs),
  ]);
  const weights = buildWeightMap(sigs);
  const raw = await runTriage(ctx.rts, ctx.llm, {
    afterTs: afterTsOf(ctx),
    senderAdjust: (id) => (id ? weights.get(id) ?? 0 : 0),
  });
  const suppressed = new Set(active.map((s) => s.permalink));
  return { ...raw, needsYou: raw.needsYou.filter((i) => !suppressed.has(i.permalink)) };
}

/** Live commitments with local overrides layered on + delivered promises
 * auto-closed (so the Ledger self-cleans everywhere it's read). */
export async function liveCommitments(ctx: TempoContext): Promise<Commitment[]> {
  const fresh = await runLedger(ctx.rts, ctx.llm, { nowTs: ctx.nowTs });
  for (const pl of await detectFulfilledCommitments(ctx.rts, fresh, { afterTs: afterTsOf(ctx) })) {
    await ctx.store.commitments.markDone(ctx.subjectUserId, pl);
  }
  return ctx.store.commitments.sync(ctx.subjectUserId, fresh);
}
