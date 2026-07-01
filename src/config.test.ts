import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// config reads process.env at import time, so each case sets env then imports a
// fresh module instance.
const SNAPSHOT = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...SNAPSHOT };
});

async function freshConfig() {
  return import("./config.js");
}

describe("assertSecretsHardened", () => {
  it("throws in a live posture (TEMPO_RTS=live) with the insecure default key", async () => {
    process.env.TEMPO_RTS = "live";
    process.env.TEMPO_RECEIVER = "socket";
    process.env.TEMPO_SLACK_ACTIONS = "mock";
    process.env.TEMPO_ENCRYPTION_KEY = "dev-insecure-key-change-me-please";
    const { assertSecretsHardened } = await freshConfig();
    expect(() => assertSecretsHardened()).toThrow(/TEMPO_ENCRYPTION_KEY/);
  });

  it("throws in the http receiver posture with a placeholder key", async () => {
    process.env.TEMPO_RTS = "mock";
    process.env.TEMPO_RECEIVER = "http";
    process.env.TEMPO_ENCRYPTION_KEY = "change-me-to-a-long-random-string";
    const { assertSecretsHardened } = await freshConfig();
    expect(() => assertSecretsHardened()).toThrow();
  });

  it("passes in a fully-mocked dev/test posture even with the default key", async () => {
    process.env.TEMPO_RTS = "mock";
    process.env.TEMPO_RECEIVER = "socket";
    process.env.TEMPO_SLACK_ACTIONS = "mock";
    process.env.TEMPO_ENCRYPTION_KEY = "dev-insecure-key-change-me-please";
    const { assertSecretsHardened } = await freshConfig();
    expect(() => assertSecretsHardened()).not.toThrow();
  });

  it("passes in a live posture with a strong unique key", async () => {
    process.env.TEMPO_RTS = "live";
    process.env.TEMPO_ENCRYPTION_KEY = "k7Q2".repeat(10); // 40 chars, no placeholder text
    const { assertSecretsHardened } = await freshConfig();
    expect(() => assertSecretsHardened()).not.toThrow();
  });
});
