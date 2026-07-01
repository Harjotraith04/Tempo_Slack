import { describe, expect, it } from "vitest";
import { webClientOptions, webClientRetryConfig } from "./webClientOptions.js";

describe("webClientOptions", () => {
  it("retries with exponential backoff and jitter", () => {
    expect(webClientRetryConfig.retries).toBeGreaterThanOrEqual(1);
    expect(webClientRetryConfig.factor).toBeGreaterThan(1); // exponential, not linear
    expect(webClientRetryConfig.randomize).toBe(true); // jitter
    expect(webClientRetryConfig.maxTimeout).toBeGreaterThan(webClientRetryConfig.minTimeout);
  });

  it("wires the retry policy into the shared WebClient options and lets 429s reach it", () => {
    expect(webClientOptions.retryConfig).toBeDefined();
    expect((webClientOptions.retryConfig as { retries?: number }).retries).toBe(webClientRetryConfig.retries);
    expect(webClientOptions.rejectRateLimitedCalls).toBe(false);
  });
});
