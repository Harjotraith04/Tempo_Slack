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
import {
  ExtractSchema,
  SYSTEM,
  buildPrompt,
  hash,
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
  const res = await rts.search({
    query:
      "promises and commitments: I'll send, I will, on it, on me, get you, by Friday, by EOD, by Wednesday",
    after: opts.afterTs,
    limit: 40,
  });
  const byLink = new Map(res.messages.map((m) => [m.permalink, m]));

  const { items } = await llm.structured({
    system: SYSTEM,
    prompt: buildPrompt(res.messages),
    schema: ExtractSchema,
    temperature: 0.1,
    mock: () => ({ items: res.messages.map(mockExtract).filter(Boolean) as any }),
  });

  const commitments: Commitment[] = [];
  for (const it of items) {
    if (!it.isCommitment) continue;
    const m = byLink.get(it.permalink);
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
