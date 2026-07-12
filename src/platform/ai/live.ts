/**
 * Live LLM adapter — calls OpenAI via the Vercel AI SDK
 * (`generateObject` / `generateText`). This is the only place the AI SDK is
 * imported; domain modules stay provider-agnostic behind `LlmPort`.
 *
 * Two provider quirks are deliberately handled here, because both fail SILENTLY
 * rather than loudly and neither is covered by the test suite (the mock adapter
 * is only selected when no API key is present):
 *
 *  1. TEMPERATURE. Every call site passes a `temperature` (0.1–0.5). The AI SDK
 *     treats any model whose id starts with `o` or `gpt-5` as a reasoning model
 *     and STRIPS the temperature, emitting only a warning — the call still
 *     succeeds, just not with the sampling we asked for. So the default model is
 *     a `gpt-4.1`-class model, which genuinely honours temperature. Do not point
 *     TEMPO_MODEL at a gpt-5.* or o-series id without first removing the
 *     temperature arguments from the call sites.
 *
 *  2. STRUCTURED OUTPUTS. OpenAI's strict json_schema mode rejects optional
 *     object properties, and our ledger schema has one (`dueText`). We therefore
 *     turn strict structured outputs OFF and let `generateObject` fall back to
 *     JSON mode with client-side zod validation — which is exactly what the
 *     previous Anthropic provider did, so behaviour (and every existing test
 *     oracle) is unchanged.
 *
 * Verify both with `npm run verify:ai`.
 */

import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { config } from "../../config.js";
import type { LlmPort, StructuredOpts, TextOpts } from "../../ports/ai.js";

const openai = config.ai.apiKey
  ? createOpenAI({ apiKey: config.ai.apiKey, compatibility: "strict" })
  : null;

function model() {
  if (!openai) throw new Error("No OPENAI_API_KEY configured for live AI mode.");
  // structuredOutputs: false — see (2) above.
  return openai(config.ai.model, { structuredOutputs: false });
}

export class LiveLlm implements LlmPort {
  async structured<T>(opts: StructuredOpts<T>): Promise<T> {
    const { object } = await generateObject({
      model: model(),
      schema: opts.schema,
      system: opts.system,
      prompt: opts.prompt,
      temperature: opts.temperature ?? 0.2,
    });
    return object;
  }

  async text(opts: TextOpts): Promise<string> {
    const { text: out } = await generateText({
      model: model(),
      system: opts.system,
      prompt: opts.prompt,
      temperature: opts.temperature ?? 0.4,
    });
    return out;
  }
}
