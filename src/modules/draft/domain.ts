/**
 * Drafting — domain types + system prompts + the deterministic mock reply that
 * doubles as the test oracle. The LLM calls live in service.ts.
 */

import type { Commitment } from "../ledger/index.js";

export const system = (name: string) =>
  `You are Tempo, drafting a short Slack reply on behalf of ${name}. Match a warm, professional, concise Slack voice. If the original implies frustration or a missed commitment, acknowledge it briefly and give a concrete next step or ETA. Never over-apologise. Output only the message text.`;

export const nudgeSystem = (name: string) =>
  `You are Tempo, drafting a short, friendly Slack nudge on behalf of ${name}, reminding someone of something they owe ${name}. Keep it warm, brief, and assume good faith — never guilt-trip. Output only the message text.`;

export const renegotiateSystem = (name: string) =>
  `You are Tempo, drafting a short Slack message on behalf of ${name}, asking to push back the deadline on something ${name} promised. Be honest about needing more time, propose a concrete new ETA if possible, and keep it brief and professional. Never over-apologise. Output only the message text.`;

export type CommitmentDraftInput = Pick<Commitment, "counterparty" | "what" | "dueText">;

export function mockDraft(sourceText: string): string {
  const t = sourceText.toLowerCase();
  if (t.includes("no rush") || t.includes("design review")) {
    return "Sorry for the delay on this, Marco — that's on me. I'll get you the design review feedback by end of day today so the handoff isn't blocked. Thanks for your patience.";
  }
  if (t.includes("checklist") || t.includes("board")) {
    return "Thanks Dana — confirming I'll own the Atlas launch checklist. I'll have the owner list and status to you by EOD today so it's ready for the board deck tomorrow.";
  }
  if (t.includes("spec") || t.includes("migration") || t.includes("blocked")) {
    return "Apologies for the hold-up, Priya — I'm prioritising the Atlas API spec today and will have it to you by EOD so eng can start sizing the migration. Flag me if you need a rough cut sooner.";
  }
  return "Thanks for the note — I'm on it and will follow up shortly with details.";
}
