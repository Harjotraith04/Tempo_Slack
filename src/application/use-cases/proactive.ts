/**
 * Proactive intelligence (v3.4) — the single opt-in, calm touchpoint appended to
 * the morning digest: a gentle overload heads-up + a batch of non-urgent FYIs
 * (fewer interruptions, not more). It NOTIFIES ONLY — never acts — and is
 * computed from counts + derived facts, never stored message content.
 */

import type { KnownBlock } from "@slack/types";
import type { TempoContext } from "../context.js";
import { liveTriage } from "../read-models.js";
import { analyzeLoad } from "../../modules/intelligence/index.js";
import { overloadBlocks, batchedFyiBlocks } from "../../platform/slack/blockkit/index.js";

export async function buildProactiveBlocks(ctx: TempoContext): Promise<KnownBlock[]> {
  const [metrics, signals, triage] = await Promise.all([
    ctx.store.metrics.get(ctx.subjectUserId),
    ctx.store.signals.forUser(ctx.subjectUserId),
    liveTriage(ctx),
  ]);
  const load = analyzeLoad(metrics, signals);
  const fyis = triage.needsYou.filter((i) => i.category === "FYI");
  return [...overloadBlocks(load), ...batchedFyiBlocks(fyis)];
}
