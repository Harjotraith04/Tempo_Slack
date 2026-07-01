/**
 * Draft helper — Tempo writes a suggested reply/deliverable, but NEVER sends it.
 * The draft is handed back to the user to review and send themselves. This is
 * the human-in-the-loop guarantee that makes Tempo safe to trust.
 */

import { text } from "../platform/ai/llm.js";
import type { Commitment } from "./ledger.js";

const SYSTEM = `You are Tempo, drafting a short Slack reply on behalf of Sam Rivera (a PM). Match a warm, professional, concise Slack voice. If the original implies frustration or a missed commitment, acknowledge it briefly and give a concrete next step or ETA. Never over-apologise. Output only the message text.`;

const NUDGE_SYSTEM = `You are Tempo, drafting a short, friendly Slack nudge on behalf of Sam Rivera (a PM), reminding someone of something they owe Sam. Keep it warm, brief, and assume good faith — never guilt-trip. Output only the message text.`;

const RENEGOTIATE_SYSTEM = `You are Tempo, drafting a short Slack message on behalf of Sam Rivera (a PM), asking to push back the deadline on something Sam promised. Be honest about needing more time, propose a concrete new ETA if possible, and keep it brief and professional. Never over-apologise. Output only the message text.`;

type CommitmentDraftInput = Pick<Commitment, "counterparty" | "what" | "dueText">;

export async function draftReply(sourceText: string): Promise<string> {
  return text({
    system: SYSTEM,
    prompt: `The message to reply to:\n"${sourceText}"\n\nWrite Sam's reply.`,
    temperature: 0.5,
    mock: () => mockDraft(sourceText),
  });
}

export async function draftNudge(c: CommitmentDraftInput): Promise<string> {
  return text({
    system: NUDGE_SYSTEM,
    prompt: `${c.counterparty} owes Sam: "${c.what}"${c.dueText ? ` (was due ${c.dueText})` : ""}.\n\nWrite a gentle nudge to ${c.counterparty}.`,
    temperature: 0.5,
    mock: () => `Hey ${c.counterparty} — just a friendly nudge on "${c.what}"${c.dueText ? ` (was due ${c.dueText})` : ""}. No worries if it's in progress, just checking in!`,
  });
}

export async function draftRenegotiation(c: CommitmentDraftInput): Promise<string> {
  return text({
    system: RENEGOTIATE_SYSTEM,
    prompt: `Sam promised ${c.counterparty}: "${c.what}"${c.dueText ? ` (due ${c.dueText})` : ""}, but needs more time.\n\nWrite a message to ${c.counterparty} asking to push the deadline.`,
    temperature: 0.5,
    mock: () => `Hi ${c.counterparty} — I need a bit more time on "${c.what}". Can we push the deadline? I'll follow up shortly with a new ETA.`,
  });
}

function mockDraft(sourceText: string): string {
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
