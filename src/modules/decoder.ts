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

import { z } from "zod";
import { structured } from "../agent/llm.js";
import type { RtsClient } from "../rts/index.js";

export interface ToneDecode {
  literalMeaning: string;
  impliedMeaning: string;
  emotionalTone: string;
  urgencyRead: string;
  socialExpectation: string;
  /** 0-1. */
  confidence: number;
  caveat: string;
}

export interface DraftCheck {
  risks: string[];
  howItLands: string;
  rewrite: string;
  plainLanguage: string;
}

const DecodeSchema = z.object({
  literalMeaning: z.string(),
  impliedMeaning: z.string(),
  emotionalTone: z.string(),
  urgencyRead: z.string(),
  socialExpectation: z.string(),
  confidence: z.number().min(0).max(1),
  caveat: z.string(),
});

const DraftSchema = z.object({
  risks: z.array(z.string()),
  howItLands: z.string(),
  rewrite: z.string(),
  plainLanguage: z.string(),
});

const DECODE_SYSTEM = `You are Tempo, helping someone who finds implicit social subtext hard to read (e.g. neurodivergent or a non-native English speaker).
Decode a Slack message honestly and kindly. Separate what it literally says from what it likely means. Name the emotional tone, the real urgency (which often differs from the words), and the concrete social expectation. Always include a confidence (0-1) and a short caveat reminding the user you can misread tone and they can check directly. Never be alarmist; be plain and grounding.`;

const DRAFT_SYSTEM = `You are Tempo, helping someone make sure their Slack message lands well. Given a draft (and optional recipient context), list concrete risks (too curt, ambiguous, could read as passive-aggressive), describe how it will likely land, and provide a clearer, warmer rewrite that keeps the user's intent, plus a plain-language version. Keep the user's voice; do not over-formalise.`;

export async function decodeMessage(
  text: string,
  opts: { rts?: RtsClient; authorName?: string } = {},
): Promise<ToneDecode> {
  const relationship = await relationshipHint(opts.rts, opts.authorName);
  return structured({
    system: DECODE_SYSTEM,
    prompt: `Message${opts.authorName ? ` from ${opts.authorName}` : ""}:\n"${text}"${relationship ? `\n\nHow they usually communicate: ${relationship}` : ""}`,
    schema: DecodeSchema,
    temperature: 0.3,
    mock: () => mockDecode(text),
  });
}

export async function checkDraft(
  draft: string,
  opts: { recipient?: string } = {},
): Promise<DraftCheck> {
  return structured({
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

// ── Deterministic mocks ──────────────────────────────────────────────────────

function mockDecode(text: string): ToneDecode {
  const t = text.toLowerCase();
  if (t.includes("no rush") || t.includes("whenever you get a chance")) {
    return {
      literalMeaning: "They say there's no rush and you can get to it whenever.",
      impliedMeaning:
        "They're actually frustrated. The '🙂' and 'only been a week' are sarcastic — they expected this days ago and the handoff is waiting on you.",
      emotionalTone: "Politely irritated / passive-aggressive.",
      urgencyRead: "Higher than the words suggest — treat as 'needed today'.",
      socialExpectation: "Reply soon with the feedback (or a firm ETA) and a brief acknowledgement of the delay.",
      confidence: 0.72,
      caveat: "Tone is hard to read over text and I can be wrong — if it matters, a quick 'sorry for the delay, you'll have it by X' covers you either way.",
    };
  }
  if (t.includes("eod") || t.includes("board")) {
    return {
      literalMeaning: "They need something confirmed by end of day.",
      impliedMeaning: "This is a real, time-boxed ask tied to something visible (a board deck). It's not optional.",
      emotionalTone: "Direct, businesslike, not unfriendly.",
      urgencyRead: "Genuinely high — there's a hard deadline.",
      socialExpectation: "Confirm today, clearly, even if the answer is 'I'll have it by 4pm'.",
      confidence: 0.85,
      caveat: "If you can't make the deadline, say so early rather than going quiet.",
    };
  }
  return {
    literalMeaning: "A straightforward message.",
    impliedMeaning: "No strong hidden subtext detected.",
    emotionalTone: "Neutral.",
    urgencyRead: "Normal.",
    socialExpectation: "Reply when convenient.",
    confidence: 0.6,
    caveat: "I can misread tone; trust your read if you know this person well.",
  };
}

function mockDraft(draft: string): DraftCheck {
  const t = draft.trim().toLowerCase();
  const curt = draft.trim().length < 25 || /^(no|nope|fine|k|ok|sure|whatever)\b/.test(t);
  if (curt) {
    return {
      risks: ["Very short — could read as cold or annoyed", "No context for why"],
      howItLands: "Likely to feel curt or dismissive, especially in writing.",
      rewrite:
        "Thanks for flagging this — I don't think that approach works for us here, but I'm happy to talk through alternatives. Want to grab 15 minutes?",
      plainLanguage: "Say no, but warmly, and offer to discuss.",
    };
  }
  return {
    risks: ["Minor: a small softener at the start would help"],
    howItLands: "Generally fine and clear.",
    rewrite: draft.trim(),
    plainLanguage: draft.trim(),
  };
}
