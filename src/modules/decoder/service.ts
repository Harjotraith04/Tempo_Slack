/**
 * Module 3 — Tone & Subtext Decoder ("The Translator"). The accessibility core.
 *
 * Two directions:
 *   decodeMessage(): explains a message's literal vs. implied meaning, tone,
 *     real urgency, and the social expectation — with an honest confidence and
 *     caveat. For neurodivergent users and non-native speakers who find implicit
 *     subtext exhausting or invisible.
 *   checkDraft(): tells the user how their own draft will land, flags
 *     curt/ambiguous/aggressive phrasing, and offers a clearer/softer rewrite +
 *     a plain-language version.
 *
 * Optionally grounded by RTS in how this specific person usually communicates.
 */

import type { LlmPort, RtsClient } from "./ports.js";
import {
  DECODE_SYSTEM,
  DRAFT_SYSTEM,
  DecodeSchema,
  DraftSchema,
  mockDecode,
  mockDraft,
  type DraftCheck,
  type ToneDecode,
} from "./domain.js";

export async function decodeMessage(
  text: string,
  llm: LlmPort,
  opts: { rts?: RtsClient; authorName?: string; familiarity?: number } = {},
): Promise<ToneDecode> {
  const relationship = await relationshipHint(opts.rts, opts.authorName);
  const decode = await llm.structured({
    system: DECODE_SYSTEM,
    prompt: `Message${opts.authorName ? ` from ${opts.authorName}` : ""}:\n"${text}"${relationship ? `\n\nHow they usually communicate: ${relationship}` : ""}`,
    schema: DecodeSchema,
    temperature: 0.3,
    mock: () => mockDecode(text),
  });
  return withFamiliarity(decode, opts.familiarity ?? 0);
}

/** Learned relationship grounding: the more history the user has acting on this
 * sender, the more confident the tone read (bounded, never past 1); with none,
 * add an honest low-history caveat. Reuses the same per-sender signals as triage. */
function withFamiliarity(decode: ToneDecode, familiarity: number): ToneDecode {
  if (familiarity <= 0) {
    return {
      ...decode,
      caveat: `${decode.caveat} (I don't have much history with this sender yet, so take this read lightly.)`,
    };
  }
  const confidence = Math.min(1, decode.confidence + Math.min(0.1, familiarity * 0.02));
  return { ...decode, confidence };
}

export async function checkDraft(
  draft: string,
  llm: LlmPort,
  opts: { recipient?: string } = {},
): Promise<DraftCheck> {
  return llm.structured({
    system: DRAFT_SYSTEM,
    prompt: `Draft${opts.recipient ? ` to ${opts.recipient}` : ""}:\n"${draft}"`,
    schema: DraftSchema,
    temperature: 0.4,
    mock: () => mockDraft(draft),
  });
}

async function relationshipHint(
  rts: RtsClient | undefined,
  authorName: string | undefined,
): Promise<string | undefined> {
  if (!rts || !authorName) return undefined;
  const res = await rts.search({ query: `messages from ${authorName}`, limit: 5 });
  const samples = res.messages
    .filter((m) => (m.authorName ?? m.authorRealName ?? "").toLowerCase().includes(authorName.toLowerCase()))
    .slice(0, 3)
    .map((m) => `"${m.text.slice(0, 80)}"`);
  return samples.length ? samples.join("; ") : undefined;
}
