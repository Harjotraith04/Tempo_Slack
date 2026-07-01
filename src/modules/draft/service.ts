/**
 * Draft helper — Tempo writes a suggested reply/deliverable, but NEVER sends it.
 * The draft is handed back to the user to review and send themselves. This is
 * the human-in-the-loop guarantee that makes Tempo safe to trust.
 */

import type { LlmPort } from "./ports.js";
import {
  NUDGE_SYSTEM,
  RENEGOTIATE_SYSTEM,
  SYSTEM,
  mockDraft,
  type CommitmentDraftInput,
} from "./domain.js";

export async function draftReply(sourceText: string, llm: LlmPort): Promise<string> {
  return llm.text({
    system: SYSTEM,
    prompt: `The message to reply to:\n"${sourceText}"\n\nWrite Sam's reply.`,
    temperature: 0.5,
    mock: () => mockDraft(sourceText),
  });
}

export async function draftNudge(c: CommitmentDraftInput, llm: LlmPort): Promise<string> {
  return llm.text({
    system: NUDGE_SYSTEM,
    prompt: `${c.counterparty} owes Sam: "${c.what}"${c.dueText ? ` (was due ${c.dueText})` : ""}.\n\nWrite a gentle nudge to ${c.counterparty}.`,
    temperature: 0.5,
    mock: () => `Hey ${c.counterparty} — just a friendly nudge on "${c.what}"${c.dueText ? ` (was due ${c.dueText})` : ""}. No worries if it's in progress, just checking in!`,
  });
}

export async function draftRenegotiation(c: CommitmentDraftInput, llm: LlmPort): Promise<string> {
  return llm.text({
    system: RENEGOTIATE_SYSTEM,
    prompt: `Sam promised ${c.counterparty}: "${c.what}"${c.dueText ? ` (due ${c.dueText})` : ""}, but needs more time.\n\nWrite a message to ${c.counterparty} asking to push the deadline.`,
    temperature: 0.5,
    mock: () => `Hi ${c.counterparty} — I need a bit more time on "${c.what}". Can we push the deadline? I'll follow up shortly with a new ETA.`,
  });
}
