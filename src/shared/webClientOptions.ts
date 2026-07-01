/**
 * Shared `@slack/web-api` client options — one source of truth for every
 * `WebClient` Tempo constructs (RTS, Slack-native actions, the Bolt app client).
 *
 * Slack rate-limits per method/workspace and returns HTTP 429 with a
 * `Retry-After`. The WebClient honours that header automatically when a
 * `retryConfig` is present; we add exponential backoff + jitter on top so a
 * burst of proactive triage never hammers the API or dies on a transient blip.
 *
 * Inert in mock mode — nothing here fires until an adapter actually talks to a
 * live workspace, so `npm run demo` / the test suite stay credential-free.
 */

import type { WebClientOptions } from "@slack/web-api";

/**
 * Exponential backoff with jitter. Passed straight to the `retry` package the
 * WebClient uses internally; `Retry-After` is layered on top of this per call.
 */
export const webClientRetryConfig = {
  retries: 5,
  factor: 2,
  minTimeout: 1_000,
  maxTimeout: 30_000,
  randomize: true, // jitter — spread retries so many users don't sync up
} as const;

export const webClientOptions: WebClientOptions = {
  retryConfig: { ...webClientRetryConfig },
  // Surface 429s to the retry/backoff machinery instead of rejecting instantly.
  rejectRateLimitedCalls: false,
};
