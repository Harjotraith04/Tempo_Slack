/**
 * Module 1 — Triage ("The Surface"). The hero feature.
 *
 * Gathers everything since the user was last active via a small set of RTS
 * searches (explicit mentions/DMs AND *implicit* blockers where nobody
 * @-mentioned them), then classifies each candidate into ACT / BLOCKER / FYI /
 * NOISE with an urgency score, a one-line reason, and a suggested next action.
 *
 * Returns a calm, ranked list — "the few things that actually need you" — that
 * the Block Kit layer renders. Nothing from RTS is persisted.
 */

import type { LlmPort, RtsClient, RtsMessage } from "./ports.js";
import {
  ClassificationSchema,
  SYSTEM,
  buildPrompt,
  mockClassify,
  rank,
  truncate,
  type TriageItem,
  type TriageResult,
} from "./domain.js";

/** Gather candidate messages since lastActive across the angles RTS unlocks. */
async function gatherCandidates(
  rts: RtsClient,
  afterTs: string,
): Promise<RtsMessage[]> {
  const queries = [
    "questions, requests, or decisions that mention me or are addressed to me",
    "someone is blocked, waiting on me, my spec, my doc, or can't start without me",
    "a decision, plan change, or deadline affecting my projects",
  ];
  const results = await Promise.all(
    queries.map((q) => rts.search({ query: q, after: afterTs, limit: 25 })),
  );
  const byKey = new Map<string, RtsMessage>();
  for (const r of results) {
    for (const m of r.messages) byKey.set(m.permalink || `${m.channelId}:${m.ts}`, m);
  }
  return [...byKey.values()];
}

export async function runTriage(
  rts: RtsClient,
  llm: LlmPort,
  opts: {
    afterTs: string;
    /** Learned per-sender ranking adjustment (from the intelligence layer). */
    senderAdjust?: (authorId?: string) => number;
  },
): Promise<TriageResult> {
  const candidates = await gatherCandidates(rts, opts.afterTs);

  const byLink = new Map(candidates.map((m) => [m.permalink, m]));

  const { items } = await llm.structured({
    system: SYSTEM,
    prompt: buildPrompt(candidates),
    schema: ClassificationSchema,
    temperature: 0.1,
    mock: () => ({ items: candidates.map(mockClassify) }),
  });

  const enriched: TriageItem[] = items
    .map((c): TriageItem | null => {
      const m = byLink.get(c.permalink);
      if (!m) return null;
      return {
        permalink: m.permalink,
        channelName: m.channelName,
        channelType: m.channelType,
        authorName: m.authorRealName ?? m.authorName,
        authorId: m.authorId,
        source: m.source,
        excerpt: truncate(m.text, 220),
        category: c.category,
        urgency: c.urgency,
        reason: c.reason,
        suggestedAction: c.suggestedAction,
      };
    })
    .filter((x): x is TriageItem => x !== null);

  const needsYou = enriched
    .filter((i) => i.category !== "NOISE")
    .sort((a, b) => rank(b, opts.senderAdjust) - rank(a, opts.senderAdjust));

  return {
    needsYou,
    scanned: candidates.length,
    handledQuietly: enriched.filter((i) => i.category === "NOISE").length,
  };
}
