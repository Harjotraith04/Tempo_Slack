/**
 * Provider-agnostic LLM wrapper.
 *
 * Two modes:
 *   - live: calls Claude via the Vercel AI SDK (`generateObject`/`generateText`).
 *   - mock: runs the colocated deterministic `mock()` for each call, so the full
 *     Tempo pipeline + `npm run demo` work with no API key. Each module supplies
 *     its own mock so behaviour stays realistic for the seeded narrative.
 *
 * Modules never import the AI SDK directly — they go through `structured()` /
 * `text()` and always pass a `mock`, which doubles as the test oracle.
 */

import { generateObject, generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { z } from "zod";
import { config } from "../config.js";

const anthropic = config.ai.anthropicApiKey
  ? createAnthropic({ apiKey: config.ai.anthropicApiKey })
  : null;

function model() {
  if (!anthropic) throw new Error("No Anthropic API key configured for live AI mode.");
  return anthropic(config.ai.model);
}

export interface StructuredOpts<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Deterministic fallback used in mock-AI mode (and as the test oracle). */
  mock: () => T;
  temperature?: number;
}

export async function structured<T>(opts: StructuredOpts<T>): Promise<T> {
  if (config.ai.mode === "mock") return opts.mock();
  const { object } = await generateObject({
    model: model(),
    schema: opts.schema,
    system: opts.system,
    prompt: opts.prompt,
    temperature: opts.temperature ?? 0.2,
  });
  return object;
}

export interface TextOpts {
  system: string;
  prompt: string;
  mock: () => string;
  temperature?: number;
}

export async function text(opts: TextOpts): Promise<string> {
  if (config.ai.mode === "mock") return opts.mock();
  const { text: out } = await generateText({
    model: model(),
    system: opts.system,
    prompt: opts.prompt,
    temperature: opts.temperature ?? 0.4,
  });
  return out;
}

export const aiMode = () => config.ai.mode;
