/**
 * AI adapter factory — resolves the concrete `LlmPort` from config:
 *   - live: calls Claude via the Vercel AI SDK.
 *   - mock: deterministic per-call oracle (runs with no API key).
 *
 * The application layer calls `getLlm()` once and injects the result down onto
 * the TempoContext so every module shares it.
 */

import { config } from "../../config.js";
import type { LlmPort } from "../../ports/ai.js";
import { MockLlm } from "./mock.js";
import { LiveLlm } from "./live.js";

export * from "../../ports/ai.js";

export function getLlm(): LlmPort {
  return config.ai.mode === "live" ? new LiveLlm() : new MockLlm();
}

export const aiMode = () => config.ai.mode;
