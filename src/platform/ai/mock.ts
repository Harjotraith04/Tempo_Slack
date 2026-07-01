/**
 * Mock LLM adapter — runs each call's colocated deterministic `mock()`, so the
 * full Tempo pipeline + `npm run demo` + the test suite work with no API key.
 * Each module supplies its own mock so behaviour stays realistic for the seeded
 * narrative, and the same mock doubles as the unit-test oracle.
 */

import type { LlmPort, StructuredOpts, TextOpts } from "../../ports/ai.js";

export class MockLlm implements LlmPort {
  async structured<T>(opts: StructuredOpts<T>): Promise<T> {
    return opts.mock();
  }
  async text(opts: TextOpts): Promise<string> {
    return opts.mock();
  }
}
