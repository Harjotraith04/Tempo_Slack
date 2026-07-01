import { describe, expect, it, vi } from "vitest";
import { mintAgentToken, resolveMcpCaller } from "./auth.js";
import { signSession } from "../../../shared/session.js";

describe("MCP caller auth — default-deny, per-user identity", () => {
  it("denies when there is no credential (never fail-open)", () => {
    expect(resolveMcpCaller(undefined)).toBeNull();
    expect(resolveMcpCaller("")).toBeNull();
    expect(resolveMcpCaller("Bearer")).toBeNull();
  });

  it("denies a garbage or tampered token", () => {
    expect(resolveMcpCaller("Bearer not-a-real-token")).toBeNull();
    const t = mintAgentToken("U_A");
    expect(resolveMcpCaller(`Bearer ${t.slice(0, -2)}xx`)).toBeNull();
  });

  it("denies an expired agent token", () => {
    const expired = signSession("U_A", -100); // already expired
    expect(resolveMcpCaller(`Bearer ${expired}`)).toBeNull();
  });

  it("resolves a signed per-user agent token to that user — no ambient authority", () => {
    expect(resolveMcpCaller(`Bearer ${mintAgentToken("U_PRIYA")}`)).toEqual({
      userId: "U_PRIYA",
      via: "agent-token",
    });
    // A different agent's token resolves to that different user.
    expect(resolveMcpCaller(`Bearer ${mintAgentToken("U_DANA")}`)?.userId).toBe("U_DANA");
  });

  it("does NOT accept a shared token unless a server user is configured (default posture)", () => {
    expect(resolveMcpCaller("Bearer some-shared-secret")).toBeNull();
  });
});

describe("MCP caller auth — shared gate (only with token AND user configured)", () => {
  it("maps the shared token to the explicitly configured user; rejects a wrong secret", async () => {
    vi.resetModules();
    const prev = { t: process.env.TEMPO_MCP_SERVER_TOKEN, u: process.env.TEMPO_MCP_SERVER_USER };
    process.env.TEMPO_MCP_SERVER_TOKEN = "shared-secret-123";
    process.env.TEMPO_MCP_SERVER_USER = "U_CONFIGURED";
    try {
      const { resolveMcpCaller: resolve } = await import("./auth.js");
      expect(resolve("Bearer shared-secret-123")).toEqual({ userId: "U_CONFIGURED", via: "shared-gate" });
      expect(resolve("Bearer wrong-secret")).toBeNull();
    } finally {
      if (prev.t === undefined) delete process.env.TEMPO_MCP_SERVER_TOKEN;
      else process.env.TEMPO_MCP_SERVER_TOKEN = prev.t;
      if (prev.u === undefined) delete process.env.TEMPO_MCP_SERVER_USER;
      else process.env.TEMPO_MCP_SERVER_USER = prev.u;
      vi.resetModules();
    }
  });
});
