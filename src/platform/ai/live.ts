/**
 * Live LLM adapter — calls Claude via the Vercel AI SDK
 * (`generateObject` / `generateText`). This is the only place the AI SDK is
 * imported; domain modules stay provider-agnostic behind `LlmPort`.
 */

import { generateObject, generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { config } from "../../config.js";
import type { LlmPort, StructuredOpts, TextOpts } from "../../ports/ai.js";

const anthropic = config.ai.anthropicApiKey
  ? createAnthropic({ apiKey: config.ai.anthropicApiKey })
  : null;

function model() {
  if (!anthropic) throw new Error("No Anthropic API key configured for live AI mode.");
  return anthropic(config.ai.model);
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
