/**
 * Module 2 — Commitment Ledger ("The Memory").
 *
 * Slack is where promises go to die. The Ledger uses RTS to find commitment
 * language — promises the user *made* ("I'll send the spec by Friday") and
 * promises *made to them* ("I'll get you the numbers by Wed") — extracts the
 * who/what/when, parses the due date (chrono), and computes status so Tempo can
 * nudge before things slip.
 *
 * COMPLIANCE: the ledger is rebuilt live from RTS each run and not persisted.
 * Only items the user explicitly *pins* are stored (a permalink + their note),
 * which is the user's own data — see platform/persistence/commitments.
 */

import type { LlmPort, RtsClient } from "./ports.js";
import { CORPUS_QUERY } from "./ports.js";
import {
  CANDIDATE_LIMIT,
  ExtractSchema,
  SYSTEM,
  buildPrompt,
  hash,
  matchFulfillments,
  mockExtract,
  parseDue,
  sortByUrgency,
  statusFor,
  type Commitment,
} from "./domain.js";

export async function runLedger(
  rts: RtsClient,
  llm: LlmPort,
  opts: { nowTs: number; afterTs?: string },
): Promise<Commitment[]> {
  // Corpus, not keywords: commitment language is endlessly varied ("on me",
  // "leave it with me", "consider it done") and an AND-scoped lexical query
  // would miss most of it. The extractor reads the window and finds promises.
  const res = await rts.search({ query: CORPUS_QUERY, after: opts.afterTs, limit: CANDIDATE_LIMIT });
  const candidates = res.messages;
  const byLink = new Map(candidates.map((m) => [m.permalink, m]));

  const { items } = await llm.structured({
    system: SYSTEM,
    prompt: buildPrompt(candidates),
    schema: ExtractSchema,
    temperature: 0.1,
    mock: () => ({ items: candidates.map(mockExtract).filter(Boolean) as any }),
  });

  const commitments: Commitment[] = [];
  for (const it of items) {
    if (!it.isCommitment) continue;
    // Resolve by prompt index (see ExtractSchema.id); permalink is the fallback.
    const byIndex =
      Number.isInteger(it.id) && it.id >= 0 && it.id < candidates.length
        ? candidates[it.id]
        : undefined;
    const m = byIndex ?? (it.permalink ? byLink.get(it.permalink) : undefined);
    if (!m) continue;
    const dueTs = parseDue(it.dueText, m.ts);
    commitments.push({
      id: hash(m.permalink),
      direction: it.direction,
      counterparty: it.counterparty,
      what: it.what,
      dueText: it.dueText,
      dueTs,
      status: statusFor(dueTs, opts.nowTs),
      permalink: m.permalink,
      sourceText: m.text,
    });
  }

  return sortByUrgency(commitments);
}

/**
 * Fulfillment detection (v2.8): searches RTS for delivery-language messages and
 * returns the permalinks of the user's own still-open commitments those messages
 * appear to fulfill. The application layer marks those commitments done so the
 * Ledger self-cleans. Heuristic (see `matchFulfillments`) — never deletes data,
 * only flips a re-derivable display status.
 */
export async function detectFulfilledCommitments(
  rts: RtsClient,
  fresh: Commitment[],
  opts: { afterTs?: string } = {},
): Promise<string[]> {
  const eligible = fresh.some((c) => c.direction === "i_owe");
  if (!eligible) return [];
  const res = await rts.search({ query: CORPUS_QUERY, after: opts.afterTs, limit: CANDIDATE_LIMIT });
  return matchFulfillments(fresh, res.messages);
}
