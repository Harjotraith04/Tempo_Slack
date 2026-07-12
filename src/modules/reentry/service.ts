/**
 * Module 5 — Re-entry ("The Bridge").
 *
 * Returning from PTO/sick/away is brutal for anyone with re-entry anxiety. This
 * reconstructs — in plain language — what changed for your projects, what was
 * decided while you were gone, who is waiting on you, and the three things that
 * matter most. Time-bounded RTS reconstruction + summarisation.
 */

import type { LlmPort, RtsClient } from "./ports.js";
import { CORPUS_QUERY } from "./ports.js";
import { Schema, SYSTEM, buildPrompt, mockBrief, type ReentryBrief } from "./domain.js";

export async function runReentry(
  rts: RtsClient,
  llm: LlmPort,
  opts: { afterTs: string; awayDays: number },
): Promise<ReentryBrief> {
  const res = await rts.search({ query: CORPUS_QUERY, after: opts.afterTs, limit: 50 });

  const brief = await llm.structured({
    system: SYSTEM,
    prompt: buildPrompt(res.messages),
    schema: Schema,
    temperature: 0.3,
    mock: () => mockBrief(res.messages),
  });

  return { ...brief, awayDays: opts.awayDays };
}
