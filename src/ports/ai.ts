/**
 * LlmPort — the AI reasoning contract the domain modules depend on.
 *
 * Modules never import the AI SDK (or the concrete adapter) directly: they
 * receive an `LlmPort` and call `structured()` / `text()`, always passing a
 * deterministic `mock`, which the mock adapter returns verbatim and which
 * doubles as the test oracle. The application layer injects the concrete
 * adapter (live Claude vs mock) resolved by config.
 */

import type { z } from "zod";

export interface StructuredOpts<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Deterministic fallback used in mock-AI mode (and as the test oracle). */
  mock: () => T;
  temperature?: number;
}

export interface TextOpts {
  system: string;
  prompt: string;
  mock: () => string;
  temperature?: number;
}

export interface LlmPort {
  structured<T>(opts: StructuredOpts<T>): Promise<T>;
  text(opts: TextOpts): Promise<string>;
}
