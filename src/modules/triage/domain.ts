/**
 * Triage — domain types + pure classification logic (schema, ranking, prompt
 * building, and the deterministic mock classifier that mirrors the seeded
 * narrative and doubles as the test oracle). No transport — see service.ts.
 */

import { z } from "zod";
import type { RtsMessage } from "../../ports/rts.js";

export type TriageCategory = "ACT" | "BLOCKER" | "FYI" | "NOISE";

export interface TriageItem {
  permalink: string;
  channelName?: string;
  channelType: RtsMessage["channelType"];
  authorName?: string;
  /** The sender's stable Slack id — the key for learned per-sender urgency. */
  authorId?: string;
  /** Which source it came from ("slack" default, or email/calendar in Attention-OS mode). */
  source?: string;
  excerpt: string;
  category: TriageCategory;
  /** 0-100; higher = more it needs you, sooner. */
  urgency: number;
  reason: string;
  suggestedAction: string;
}

export interface TriageResult {
  /** Items that need the user, ranked; excludes NOISE. */
  needsYou: TriageItem[];
  scanned: number;
  handledQuietly: number;
}

/**
 * How many messages one triage pulls from RTS.
 *
 * The live adapter pages at 20 per request and follows `next_cursor`
 * SEQUENTIALLY, so the round-trip count is ceil(limit/20): 50 → 3, 20 → 1.
 * Every candidate also costs output tokens in the classify call below, and
 * output tokens are decoded one at a time — so this number, not the prompt
 * size, is what sets the reply latency.
 */
export const CANDIDATE_LIMIT = 20;

export const ItemSchema = z.object({
  /**
   * The `[n]` index of the message in the prompt — NOT its permalink.
   *
   * This field used to be `permalink: z.string()`, and that single choice was
   * the entire latency problem: a Slack permalink is ~28 tokens, it tokenizes
   * badly, and output tokens are decoded autoregressively. Echoing an index
   * instead cuts roughly a third of the output tokens, and it removes a real
   * failure mode — a model that mistyped one character of a URL had its item
   * silently dropped on the way back (`byLink.get()` → undefined).
   */
  id: z.number().int().min(0),
  /** Fallback only, for a model that volunteers the permalink anyway. */
  permalink: z.string().optional(),
  category: z.enum(["ACT", "BLOCKER", "FYI", "NOISE"]),
  urgency: z.number().min(0).max(100),
  reason: z.string(),
  suggestedAction: z.string(),
});
export const ClassificationSchema = z.object({ items: z.array(ItemSchema) });

export const system = (name: string) =>
  `You are Tempo, an executive-function co-pilot inside Slack. You triage a person's unread Slack so they can spend attention only where it matters.
Classify each message for the user (${name}) into exactly one category:
- ACT: directly needs ${name}'s reply, decision, or deliverable.
- BLOCKER: someone is blocked or waiting on ${name}, even if they did not @-mention them.
- FYI: relevant context ${name} should know (a decision, a change to their projects) but no action required right now.
- NOISE: banter, broad announcements, bot chatter — safe to skip.
Give an urgency 0-100 (seniority of asker, explicit deadlines, how many people are blocked, how long it has waited). Write a one-line plain-language reason and a concrete suggestedAction ("Draft a reply", "Send the spec", "Skim later"). Be calm and conservative: most messages are NOISE or FYI.`;

/** Ranking score. `adjust` is an optional learned per-sender term (bounded by
 * the intelligence module) that nudges ordering without overriding classification. */
export function rank(i: TriageItem, adjust?: (authorId?: string) => number): number {
  const catWeight: Record<TriageCategory, number> = { ACT: 30, BLOCKER: 25, FYI: 5, NOISE: 0 };
  return i.urgency + catWeight[i.category] + (adjust?.(i.authorId) ?? 0);
}

export function buildPrompt(messages: RtsMessage[]): string {
  const lines = messages.map(
    (m, i) =>
      `[${i}] permalink=${m.permalink} channel=#${m.channelName ?? "?"} (${m.channelType}) from=${m.authorRealName ?? m.authorName ?? m.authorId}${m.mentionsMe ? " (mentions me)" : ""}\n    "${m.text}"`,
  );
  return `Classify these ${messages.length} messages. Return exactly one entry per message, setting "id" to the number in its square brackets. Do not repeat the permalink — the id is enough.\n\n${lines.join("\n")}`;
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

// ── Deterministic mock classifier (mirrors the seeded narrative) ─────────────

export function mockClassify(m: RtsMessage, i: number): z.infer<typeof ItemSchema> {
  const t = m.text.toLowerCase();
  const dm = m.channelType === "im";
  const base = (
    category: TriageCategory,
    urgency: number,
    reason: string,
    suggestedAction: string,
  ) => ({ id: i, permalink: m.permalink, category, urgency, reason, suggestedAction });

  // Most-specific patterns first.
  if (t.includes("no rush") || t.includes("whenever you get a chance")) {
    return base("ACT", 70, "Reads as 'no rush' but it's passive-aggressive — the handoff is waiting on your feedback.", "Reply with the design feedback");
  }
  if ((t.includes("board") || t.includes("eod")) && (t.includes("need") || t.includes("confirm"))) {
    return base("ACT", dm ? 95 : 85, "A VP needs this confirmed today for the board deck.", "Confirm the owner and reply now");
  }
  if (t.includes("blocked") || t.includes("waiting on") || t.includes("can't start") || t.includes("parked")) {
    // A short "me too" echo ("yeah same, parked") is secondary to the primary blocker.
    const echo = m.text.length < 60 || t.startsWith("yeah") || t.includes("same");
    return echo
      ? base("FYI", 55, "Another teammate is also blocked on your spec (a 'me too' on the main blocker).", "Skim — unblocking the spec covers this too")
      : base("BLOCKER", 88, "Engineering is blocked waiting on your spec — no @mention, but it's on you.", "Send the spec or give an ETA");
  }
  if ((t.includes("decision") || t.includes("moving")) && (t.includes("ga") || t.includes("aug"))) {
    return base("FYI", 60, "A launch-date decision was made while you were out — affects your plan.", "Skim and update your checklist");
  }
  if (t.includes("i'll get you") || t.includes("get you the") || t.includes("on me")) {
    return base("FYI", 40, "Someone owes you something — tracked in your commitments.", "No action; Tempo will nudge them");
  }
  if (m.channelName === "general" || m.channelName === "random") {
    return base("NOISE", 8, "Workspace banter / broad announcement.", "Skip");
  }
  if (dm && m.mentionsMe) return base("ACT", 65, "A direct message addressed to you.", "Reply when you can");
  return base("FYI", 25, "Background context on your projects.", "Skim later");
}
