/**
 * Draft helper — Tempo writes a suggested reply/deliverable, but NEVER sends it.
 * The draft is handed back to the user to review and send themselves. This is
 * the human-in-the-loop guarantee that makes Tempo safe to trust.
 */

import { text } from "../agent/llm.js";

const SYSTEM = `You are Tempo, drafting a short Slack reply on behalf of Sam Rivera (a PM). Match a warm, professional, concise Slack voice. If the original implies frustration or a missed commitment, acknowledge it briefly and give a concrete next step or ETA. Never over-apologise. Output only the message text.`;

export async function draftReply(sourceText: string): Promise<string> {
  return text({
    system: SYSTEM,
    prompt: `The message to reply to:\n"${sourceText}"\n\nWrite Sam's reply.`,
    temperature: 0.5,
    mock: () => mockDraft(sourceText),
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
