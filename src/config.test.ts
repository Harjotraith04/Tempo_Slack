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

describe("Vercel posture (VERCEL=1)", () => {
  const STRONG_KEY = "k7Q2".repeat(10); // 40 chars, no placeholder text

  it("defaults the receiver to http on Vercel, which arms the live posture", async () => {
    process.env.VERCEL = "1";
    delete process.env.TEMPO_RECEIVER;
    const { config, isLivePosture } = await freshConfig();
    expect(config.runtime.receiver).toBe("http");
    expect(config.runtime.isVercel).toBe(true);
    expect(isLivePosture()).toBe(true);
  });

  it("still honors an explicit TEMPO_RECEIVER override on Vercel", async () => {
    process.env.VERCEL = "1";
    process.env.TEMPO_RECEIVER = "http";
    const { config } = await freshConfig();
    expect(config.runtime.receiver).toBe("http");
  });

  it("assertVercelRuntime rejects the insecure default encryption key on Vercel", async () => {
    process.env.VERCEL = "1";
    delete process.env.TEMPO_RECEIVER;
    process.env.TEMPO_ENCRYPTION_KEY = "dev-insecure-key-change-me-please";
    process.env.DATABASE_URL = "postgres://user:pass@host/db";
    const { assertVercelRuntime } = await freshConfig();
    expect(() => assertVercelRuntime()).toThrow(/TEMPO_ENCRYPTION_KEY/);
  });

  it("assertVercelRuntime rejects the file store on Vercel's read-only filesystem", async () => {
    process.env.VERCEL = "1";
    delete process.env.TEMPO_RECEIVER;
    process.env.TEMPO_ENCRYPTION_KEY = STRONG_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.TEMPO_STORE;
    const { assertVercelRuntime } = await freshConfig();
    expect(() => assertVercelRuntime()).toThrow(/TEMPO_STORE=file/);
  });

  it("assertVercelRuntime passes with a strong key and a Postgres store", async () => {
    process.env.VERCEL = "1";
    delete process.env.TEMPO_RECEIVER;
    process.env.TEMPO_ENCRYPTION_KEY = STRONG_KEY;
    process.env.DATABASE_URL = "postgres://user:pass@host/db";
    const { assertVercelRuntime } = await freshConfig();
    expect(() => assertVercelRuntime()).not.toThrow();
  });

  it("no-ops entirely off Vercel, keeping the zero-credential dev loop green", async () => {
    delete process.env.VERCEL;
    process.env.TEMPO_ENCRYPTION_KEY = "dev-insecure-key-change-me-please";
    delete process.env.DATABASE_URL;
    const { assertVercelRuntime, config } = await freshConfig();
    expect(config.runtime.receiver).toBe("socket");
    expect(() => assertVercelRuntime()).not.toThrow();
  });
});
