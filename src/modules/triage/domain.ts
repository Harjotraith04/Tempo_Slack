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

export const ItemSchema = z.object({
  permalink: z.string(),
  category: z.enum(["ACT", "BLOCKER", "FYI", "NOISE"]),
  urgency: z.number().min(0).max(100),
  reason: z.string(),
  suggestedAction: z.string(),
});
export const ClassificationSchema = z.object({ items: z.array(ItemSchema) });

export const SYSTEM = `You are Tempo, an executive-function co-pilot inside Slack. You triage a person's unread Slack so they can spend attention only where it matters.
Classify each message for the user (Sam Rivera, a PM) into exactly one category:
- ACT: directly needs Sam's reply, decision, or deliverable.
- BLOCKER: someone is blocked or waiting on Sam, even if they did not @-mention him.
- FYI: relevant context Sam should know (a decision, a change to his projects) but no action required right now.
- NOISE: banter, broad announcements, bot chatter — safe to skip.
Give an urgency 0-100 (seniority of asker, explicit deadlines, how many people are blocked, how long it has waited). Write a one-line plain-language reason and a concrete suggestedAction ("Draft a reply", "Send the spec", "Skim later"). Be calm and conservative: most messages are NOISE or FYI.`;

export function rank(i: TriageItem): number {
  const catWeight: Record<TriageCategory, number> = { ACT: 30, BLOCKER: 25, FYI: 5, NOISE: 0 };
  return i.urgency + catWeight[i.category];
}

export function buildPrompt(messages: RtsMessage[]): string {
  const lines = messages.map(
    (m, i) =>
      `[${i}] permalink=${m.permalink} channel=#${m.channelName ?? "?"} (${m.channelType}) from=${m.authorRealName ?? m.authorName ?? m.authorId}${m.mentionsMe ? " (mentions me)" : ""}\n    "${m.text}"`,
  );
  return `Classify these ${messages.length} messages. Return an entry for every permalink.\n\n${lines.join("\n")}`;
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

// ── Deterministic mock classifier (mirrors the seeded narrative) ─────────────

export function mockClassify(m: RtsMessage): z.infer<typeof ItemSchema> {
  const t = m.text.toLowerCase();
  const dm = m.channelType === "im";
  const base = (
    category: TriageCategory,
    urgency: number,
    reason: string,
    suggestedAction: string,
  ) => ({ permalink: m.permalink, category, urgency, reason, suggestedAction });

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
