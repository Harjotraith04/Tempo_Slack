/**
 * Conversation service.
 *
 * The ordering here is the whole point: `isCrisis()` runs FIRST, and on a match
 * the LLM is never called. Everything else goes to the model with the guardrailed
 * prompt.
 */

import type { LlmPort } from "./ports.js";
import { ChatSchema, mockChat, system, type ChatReply } from "./domain.js";
import { isCrisis, CRISIS_RESPONSE } from "./safety.js";

export interface ChatResult extends ChatReply {
  /** True when the deterministic crisis path produced this, not the model. */
  crisis: boolean;
}

export async function converse(
  input: string,
  llm: LlmPort,
  opts: { name: string },
): Promise<ChatResult> {
  // HARD GATE. A generative model must never improvise here — see safety.ts.
  // This returns before `llm` is touched, and converse.test.ts asserts exactly
  // that by failing if the port is called at all.
  if (isCrisis(input)) {
    return { reply: CRISIS_RESPONSE, supportive: true, suggest: "none", crisis: true };
  }

  const reply = await llm.structured({
    system: system(opts.name),
    prompt: input,
    schema: ChatSchema,
    // Warm enough to sound human, cool enough not to freewheel at someone who
    // just said they're struggling.
    temperature: 0.4,
    mock: () => mockChat(input),
  });

  return { ...reply, crisis: false };
}
